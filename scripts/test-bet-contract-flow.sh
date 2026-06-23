#!/usr/bin/env bash
# Local integration test: compliance-ready user → live bet → contract → resolve → emails.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:54321}"
ANON_KEY="${SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }

echo "Bet contract flow integration test"
echo "=================================="

if ! psql "$DB_URL" -c "select 1" >/dev/null 2>&1; then
  warn "Local Postgres not reachable — skipping flow test"
  exit 0
fi

MIGRATION_OK="$(psql "$DB_URL" -tAc \
  "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version = '20260627150000'")"
[[ "$MIGRATION_OK" == "1" ]] || fail "bet_contracts migration not applied"

ADMIN_EMAIL="$(psql "$DB_URL" -tAc "SELECT email FROM public.users WHERE is_admin = true ORDER BY created_at LIMIT 1" | tr -d '[:space:]')"
[[ -n "$ADMIN_EMAIL" ]] || fail "no admin user in local database"

E2E_API_SETUP="${E2E_API_SETUP:-1}" E2E_TEST_EMAIL="bet-contract-flow-$(date +%s)@resend.dev" \
  npx tsx scripts/seed-e2e-fixtures.ts

STATE_FILE="tests/e2e/.runtime/e2e-state.json"
[[ -f "$STATE_FILE" ]] || fail "missing $STATE_FILE after seed"

SUPABASE_URL="$SUPABASE_URL" \
SUPABASE_ANON_KEY="$ANON_KEY" \
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY" \
ADMIN_EMAIL="$ADMIN_EMAIL" \
RUN_BET_CONTRACT_EMAIL_TEST="${RUN_BET_CONTRACT_EMAIL_TEST:-0}" \
node <<'NODE'
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.ADMIN_EMAIL;
const state = JSON.parse(fs.readFileSync('tests/e2e/.runtime/e2e-state.json', 'utf8'));

async function adminAccessToken() {
  const adminAuth = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: linkData, error: linkError } = await adminAuth.auth.admin.generateLink({
    type: 'magiclink',
    email: adminEmail,
  });
  if (linkError) throw linkError;

  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  if (linkData.properties?.email_otp) {
    const { data: otpData, error: otpError } = await client.auth.verifyOtp({
      email: adminEmail,
      token: linkData.properties.email_otp,
      type: 'magiclink',
    });
    if (otpError) throw otpError;
    return otpData.session?.access_token;
  }
  if (linkData.properties?.hashed_token) {
    const { data: otpData, error: otpError } = await client.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink',
    });
    if (otpError) throw otpError;
    return otpData.session?.access_token;
  }
  throw new Error('Could not obtain admin access token');
}

(async () => {
  const authed = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: signIn, error: signInError } = await authed.auth.signInWithPassword({
    email: state.testEmail,
    password: state.testPassword,
  });
  if (signInError) throw signInError;
  if (!signIn.session) throw new Error('No session after sign-in');

  const { data: playBet, error: playBetError } = await authed.rpc('place_bet', {
    p_market_id: state.marketId,
    p_option_id: state.yesOptionId,
    p_amount: 5,
    p_side: 'yes',
    p_is_play_mode: true,
  });
  if (playBetError) throw playBetError;
  if (!playBet?.id) throw new Error('play mode place_bet returned no bet');
  console.log('PLAY BET:', playBet.id);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: playContract } = await admin
    .from('bet_contracts')
    .select('id')
    .eq('bet_id', playBet.id)
    .maybeSingle();
  if (playContract?.id) {
    throw new Error('bet_contracts row created for play mode bet — expected none');
  }
  console.log('PLAY MODE NEGATIVE OK — no contract row');

  const { data: bet, error: betError } = await authed.rpc('place_bet', {
    p_market_id: state.marketId,
    p_option_id: state.yesOptionId,
    p_amount: 10,
    p_side: 'yes',
    p_is_play_mode: false,
  });
  if (betError) throw betError;
  if (!bet?.id) throw new Error('place_bet returned no bet');
  console.log('BET:', bet.id);

  for (let attempt = 1; attempt <= 5; attempt++) {
    const { data: contract } = await admin
      .from('bet_contracts')
      .select('*')
      .eq('bet_id', bet.id)
      .maybeSingle();
    if (!contract?.id) {
      await new Promise((r) => setTimeout(r, 400));
      continue;
    }

    if (!contract.placed_snapshot?.market?.question) {
      throw new Error('placed_snapshot missing market.question');
    }
    console.log('CONTRACT:', contract.id, contract.contract_number);

    if (process.env.RUN_BET_CONTRACT_EMAIL_TEST === '1') {
      const { data: emailResult, error: emailError } = await authed.functions.invoke('send-bet-contract-email', {
        body: { contractId: contract.id, eventType: 'placed' },
      });
      if (emailError) throw emailError;
      if (emailResult?.error) throw new Error(emailResult.error);
      console.log('PLACED EMAIL:', JSON.stringify(emailResult));

      const { data: refreshed } = await admin
        .from('bet_contracts')
        .select('placed_email_sent_at')
        .eq('id', contract.id)
        .single();
      if (!refreshed?.placed_email_sent_at) {
        throw new Error('placed_email_sent_at not set after send');
      }
    } else {
      console.log('PLACED EMAIL: skipped (RUN_BET_CONTRACT_EMAIL_TEST=1 to send)');
    }

    const token = await adminAccessToken();
    const resolver = createClient(url, anonKey, {
      global: { headers: { Authorization: 'Bearer ' + token } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: resolveError } = await resolver.rpc('resolve_market', {
      p_market_id: state.marketId,
      p_winning_option_id: state.yesOptionId,
      p_evidence_url: null,
      p_evidence_notes: 'E2E automated resolution',
    });
    if (resolveError) throw resolveError;
    console.log('RESOLVED market');

    const { data: dispatchResult, error: dispatchError } = await resolver.functions.invoke(
      'dispatch-market-contract-emails',
      { body: { marketId: state.marketId } },
    );
    if (dispatchError) throw dispatchError;
    console.log('DISPATCH:', JSON.stringify(dispatchResult));

    const { data: finalContract } = await admin
      .from('bet_contracts')
      .select('resolved_snapshot, resolved_email_sent_at')
      .eq('id', contract.id)
      .single();

    if (!finalContract?.resolved_snapshot) {
      throw new Error('resolved_snapshot missing after resolve_market');
    }

    const { outcome, payoutAmount } = finalContract.resolved_snapshot;
    if (outcome !== 'won') {
      throw new Error(`expected outcome won, got ${outcome}`);
    }
    if (Number(payoutAmount) < 10) {
      throw new Error(`expected payoutAmount >= 10 for winning YES bet, got ${payoutAmount}`);
    }
    console.log('RESOLUTION OUTCOME OK:', { outcome, payoutAmount });

    if (process.env.RUN_BET_CONTRACT_EMAIL_TEST === '1') {
      if (!finalContract.resolved_email_sent_at) {
        throw new Error('resolved_email_sent_at not set after dispatch');
      }
      console.log('RESOLVED EMAIL TIMESTAMP OK');
    }

    console.log('RESOLVED SNAPSHOT OK');
    return;
  }

  throw new Error('bet_contracts row not created after place_bet');
})().catch((err) => {
  console.error('BET CONTRACT FLOW FAILED:', err.message || err);
  process.exit(1);
});
NODE

pass "bet contract API flow completed"

if [[ "${RUN_BET_CONTRACT_EMAIL_TEST:-0}" == "1" ]]; then
  pass "optional contract email send completed"
else
  warn "contract email skipped — set RUN_BET_CONTRACT_EMAIL_TEST=1 to include Resend"
fi

echo ""
echo -e "${GREEN}Bet contract flow integration test passed.${NC}"
