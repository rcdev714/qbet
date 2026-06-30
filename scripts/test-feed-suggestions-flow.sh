#!/usr/bin/env bash
# Feed suggestions integration test: schema, RLS, admin RPCs; optional live Gemini invoke.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:54321}"
ANON_KEY="${SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU}"
FN_ENV="supabase/functions/.env"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }

echo "Feed suggestions flow integration test"
echo "======================================"

if ! psql "$DB_URL" -c "select 1" >/dev/null 2>&1; then
  warn "Local Postgres not reachable — skipping flow test"
  exit 0
fi

MIGRATION_OK="$(psql "$DB_URL" -tAc \
  "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version IN ('20260702000000','20260702000002')")"
[[ "$MIGRATION_OK" == "2" ]] || fail "feed suggestion migrations not applied ($MIGRATION_OK/2) — run: npx supabase migration up --local"

ADMIN_EMAIL="$(psql "$DB_URL" -tAc "SELECT email FROM public.users WHERE is_admin = true ORDER BY created_at LIMIT 1")"
[[ -n "$ADMIN_EMAIL" ]] || fail "no admin user — set is_admin = true on a local user"

pass "migration applied; admin=$ADMIN_EMAIL"

node <<NODE
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const url = process.env.SUPABASE_URL || '$SUPABASE_URL';
const anonKey = process.env.SUPABASE_ANON_KEY || '$ANON_KEY';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '$SERVICE_KEY';
const adminEmail = '$ADMIN_EMAIL';

(async () => {
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const batchId = randomUUID();
  const runDate = new Date().toISOString().slice(0, 10);

  const { error: batchError } = await admin.from('feed_suggestion_batches').insert({
    id: batchId,
    cron_slot: '08:00',
    run_date: runDate,
    status: 'completed',
    triggered_by: 'manual',
    suggestion_count: 1,
    gemini_model: 'test-fixture',
    completed_at: new Date().toISOString(),
  });
  if (batchError) throw batchError;

  const suggestionId = randomUUID();
  const { error: suggestionError } = await admin.from('feed_market_suggestions').insert({
    id: suggestionId,
    batch_id: batchId,
    category: 'Tech',
    subject: 'E2E fixture subject',
    horizon: 'near_term',
    question: 'Will the E2E feed suggestion test pass?',
    description: 'Fixture for integration test',
    options: ['Yes', 'No'],
    suggested_closes_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    source_urls: ['https://example.com/e2e'],
    search_queries: ['e2e test query'],
    rationale: 'Automated test fixture',
    status: 'pending',
    evidence_sources: [{
      url: 'https://example.com/e2e',
      title: 'E2E source',
      publisher: 'Example',
      source_type: 'credible_media',
      supports: 'Fixture source',
    }],
    resolution_source_url: 'https://example.com/e2e',
    resolution_criteria: 'Resolves Yes if the E2E feed suggestion integration test passes.',
    expected_resolution_at: new Date(Date.now() + 8 * 86400000).toISOString(),
    close_date_reason: 'Closes before the test outcome is known.',
    resolution_date_source_url: 'https://example.com/e2e',
    source_quality_score: 75,
    source_count: 1,
    engagement_score: 80,
    resolution_quality_score: 80,
    compliance_risk_score: 10,
    autopilot_score: 70,
    autopilot_status: 'needs_review',
  });
  if (suggestionError) throw suggestionError;
  console.log('FIXTURE:', suggestionId);

  const { data: anonRows, error: anonError } = await anon
    .from('feed_market_suggestions')
    .select('id')
    .eq('id', suggestionId);
  if (anonError) throw anonError;
  if (anonRows?.length) throw new Error('anon should not read feed_market_suggestions');

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: adminEmail,
  });
  if (linkError) throw linkError;

  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  let accessToken;
  if (linkData.properties?.email_otp) {
    const { data: otpData, error: otpError } = await client.auth.verifyOtp({
      email: adminEmail,
      token: linkData.properties.email_otp,
      type: 'magiclink',
    });
    if (otpError) throw otpError;
    accessToken = otpData.session?.access_token;
  } else if (linkData.properties?.hashed_token) {
    const { data: otpData, error: otpError } = await client.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink',
    });
    if (otpError) throw otpError;
    accessToken = otpData.session?.access_token;
  }
  if (!accessToken) throw new Error('Could not obtain admin access token');

  const authed = createClient(url, anonKey, {
    global: { headers: { Authorization: 'Bearer ' + accessToken } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: adminRows, error: adminReadError } = await authed
    .from('feed_market_suggestions')
    .select('id, question')
    .eq('id', suggestionId)
    .maybeSingle();
  if (adminReadError) throw adminReadError;
  if (!adminRows?.id) throw new Error('admin should read pending suggestion');

  const { data: dismissed, error: dismissError } = await authed.rpc('admin_dismiss_feed_suggestion', {
    p_id: suggestionId,
    p_feedback_reason: 'e2e_feedback',
  });
  if (dismissError) throw dismissError;
  if (dismissed?.status !== 'dismissed') throw new Error('dismiss RPC failed');
  if (dismissed?.admin_feedback_reason !== 'e2e_feedback') throw new Error('dismiss feedback missing');

  await admin.from('feed_market_suggestions').delete().eq('batch_id', batchId);
  await admin.from('feed_suggestion_batches').delete().eq('id', batchId);

  console.log('RPC_DISMISS: ok');
})().catch((err) => {
  console.error('FLOW TEST FAILED:', err.message || err);
  process.exit(1);
});
NODE

pass "fixture insert → RLS → admin read → dismiss RPC"

if [[ "${RUN_FEED_SUGGESTIONS_GEMINI_TEST:-0}" == "1" ]]; then
  echo ""
  echo "── Live Gemini invoke ──"

  if [[ ! -f "$FN_ENV" ]]; then
    fail "$FN_ENV missing — copy from supabase/functions/.env.example"
  fi

  # shellcheck disable=SC1090
  set -a && source "$FN_ENV" && set +a

  [[ -n "${GEMINI_API_KEY:-}" ]] || fail "GEMINI_API_KEY missing in $FN_ENV"
  [[ -n "${CRON_INVOKER_SECRET:-}" ]] || fail "CRON_INVOKER_SECRET missing in $FN_ENV"

  FUNCTIONS_URL="${SUPABASE_URL}/functions/v1/generate-feed-suggestions"
  RESPONSE="$(curl -sS -w "\n%{http_code}" -X POST "$FUNCTIONS_URL" \
    -H "Authorization: Bearer $CRON_INVOKER_SECRET" \
    -H "Content-Type: application/json" \
    -d '{"force": true, "slot": "08:00", "triggered_by": "manual"}')"
  HTTP_BODY="$(echo "$RESPONSE" | sed '$d')"
  HTTP_CODE="$(echo "$RESPONSE" | tail -n 1)"

  if [[ "$HTTP_CODE" != "200" ]]; then
    echo "$HTTP_BODY"
    fail "generate-feed-suggestions returned HTTP $HTTP_CODE (is the function served?)"
  fi

  echo "$HTTP_BODY" | grep -q '"ok":true' || fail "unexpected response body: $HTTP_BODY"
  pass "live Gemini invoke succeeded"

  SUGGESTION_COUNT="$(psql "$DB_URL" -tAc \
    "SELECT suggestion_count FROM feed_suggestion_batches WHERE status = 'completed' ORDER BY started_at DESC LIMIT 1")"
  [[ "${SUGGESTION_COUNT:-0}" -ge 1 ]] || fail "no suggestions inserted after Gemini run"
  pass "batch has $SUGGESTION_COUNT suggestions"
else
  warn "live Gemini skipped — set RUN_FEED_SUGGESTIONS_GEMINI_TEST=1 and serve generate-feed-suggestions"
fi

echo ""
echo -e "${GREEN}Feed suggestions flow integration test passed.${NC}"
