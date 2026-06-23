#!/usr/bin/env bash
# Local integration test: submit → approve → resolve (optional Resend send).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:54321}"
ANON_KEY="${SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU}"
TEST_EMAIL="beta-flow-test-$(date +%s)@example.com"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }

echo "Beta approval flow integration test"
echo "==================================="

if ! psql "$DB_URL" -c "select 1" >/dev/null 2>&1; then
  warn "Local Postgres not reachable — skipping flow test"
  exit 0
fi

MIGRATION_COUNT="$(psql "$DB_URL" -tAc \
  "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version IN ('20260625120000','20260626120000')")"
[[ "$MIGRATION_COUNT" == "2" ]] || fail "beta access migrations not applied ($MIGRATION_COUNT/2)"

ADMIN_EMAIL="$(psql "$DB_URL" -tAc "SELECT email FROM public.users WHERE is_admin = true ORDER BY created_at LIMIT 1")"
[[ -n "$ADMIN_EMAIL" ]] || fail "no admin user in local database"

pass "migrations applied; admin=$ADMIN_EMAIL"

node <<NODE
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL || '$SUPABASE_URL';
const anonKey = process.env.SUPABASE_ANON_KEY || '$ANON_KEY';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '$SERVICE_KEY';
const testEmail = '$TEST_EMAIL';
const adminEmail = '$ADMIN_EMAIL';

(async () => {
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: requestId, error: submitError } = await anon.rpc('submit_beta_access_request', {
    p_email: testEmail,
    p_full_name: 'Flow Test User',
    p_country_code: 'EC',
    p_message: 'integration test',
  });
  if (submitError) throw submitError;
  console.log('SUBMITTED:', requestId);

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

  const { data: approved, error: approveError } = await authed.rpc('approve_beta_access_request', {
    p_request_id: requestId,
    p_admin_notes: 'integration test approve',
  });
  if (approveError) throw approveError;
  if (!approved?.approval_token) throw new Error('approval_token missing after approve');
  console.log('APPROVED:', approved.email, approved.approval_token);

  const { data: resolved, error: resolveError } = await anon.rpc('resolve_beta_approval_token', {
    p_token: approved.approval_token,
  });
  if (resolveError) throw resolveError;
  const row = Array.isArray(resolved) ? resolved[0] : resolved;
  if (!row || row.email !== testEmail) throw new Error('resolve_beta_approval_token failed');
  console.log('RESOLVED:', row.email);

  const { data: badResolve } = await anon.rpc('resolve_beta_approval_token', {
    p_token: '00000000-0000-0000-0000-000000000000',
  });
  const badRow = Array.isArray(badResolve) ? badResolve[0] : badResolve;
  if (badRow) throw new Error('invalid token should not resolve');

  if (process.env.RUN_BETA_EMAIL_TEST === '1') {
    const { data: emailResult, error: emailError } = await authed.functions.invoke('send-beta-approval-email', {
      body: { requestId },
    });
    if (emailError) throw emailError;
    if (emailResult?.error) throw new Error(emailResult.error);
    console.log('EMAIL:', JSON.stringify(emailResult));
  } else {
    console.log('EMAIL: skipped (set RUN_BETA_EMAIL_TEST=1 to send)');
  }
})().catch((err) => {
  console.error('FLOW TEST FAILED:', err.message || err);
  process.exit(1);
});
NODE

pass "submit → approve → resolve flow"

if [[ "${RUN_BETA_EMAIL_TEST:-0}" == "1" ]]; then
  pass "optional email send completed"
else
  warn "email send skipped — set RUN_BETA_EMAIL_TEST=1 to include Resend"
fi

echo ""
echo -e "${GREEN}Beta approval flow integration test passed.${NC}"
