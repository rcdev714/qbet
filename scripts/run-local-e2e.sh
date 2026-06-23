#!/usr/bin/env bash
# Full local E2E: Supabase + Stripe listeners + edge functions + web + Playwright.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }

PIDS=()
cleanup() {
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  [[ -f tests/e2e/.stripe-listen.pids ]] && kill $(cat tests/e2e/.stripe-listen.pids) 2>/dev/null || true
}
trap cleanup EXIT INT TERM

E2E_STRICT=0 bash scripts/check-e2e-local-env.sh || true

echo ""
echo "── Supabase migrations ──"
if ! npx supabase status >/dev/null 2>&1; then
  npx supabase start
fi
npx supabase migration up --local

echo ""
echo "── Stripe webhook listeners ──"
STRIPE_LISTEN_FOREGROUND=0 bash scripts/stripe-e2e-listen.sh &
PIDS+=($!)
sleep 3

bash scripts/check-e2e-local-env.sh || fail "E2E env check failed — fix warnings or set E2E_STRICT=0"

SECRETS_FILE="tests/e2e/.stripe-secrets.env"
FN_ENV="supabase/functions/.env"
MERGED_ENV="$(mktemp)"
if [[ -f "$FN_ENV" ]]; then
  cat "$FN_ENV" >"$MERGED_ENV"
else
  fail "$FN_ENV missing"
fi

# E2E must use Stripe test mode — overlay sk_test from CLI when functions/.env has live/restricted keys.
if command -v stripe >/dev/null 2>&1; then
  STRIPE_TEST_KEY="$(stripe config --list 2>/dev/null | sed -n "s/^test_mode_api_key = '\(sk_test_[^']*\)'.*/\1/p" | head -1 || true)"
  if [[ -n "$STRIPE_TEST_KEY" ]]; then
    grep -v '^STRIPE_SECRET_KEY=' "$MERGED_ENV" >"${MERGED_ENV}.tmp" && mv "${MERGED_ENV}.tmp" "$MERGED_ENV"
    echo "STRIPE_SECRET_KEY=$STRIPE_TEST_KEY" >>"$MERGED_ENV"
    pass "Using Stripe test secret from CLI for E2E functions"
  fi
fi
if [[ -f "$SECRETS_FILE" ]]; then
  grep -v '^STRIPE_WEBHOOK_SECRET=' "$SECRETS_FILE" | grep -v '^STRIPE_IDENTITY_WEBHOOK_SECRET=' >>"$MERGED_ENV" || true
  grep '^STRIPE_WEBHOOK_SECRET=' "$SECRETS_FILE" >>"$MERGED_ENV" || true
  grep '^STRIPE_IDENTITY_WEBHOOK_SECRET=' "$SECRETS_FILE" >>"$MERGED_ENV" || true
fi

echo ""
echo "── Edge functions ──"
FUNCTIONS=(
  send-beta-approval-email
  create-identity-session
  stripe-checkout
  stripe-webhook
  stripe-identity-webhook
  send-bet-contract-email
  dispatch-market-contract-emails
)
npx supabase functions serve "${FUNCTIONS[@]}" --env-file "$MERGED_ENV" >tests/e2e/.functions.log 2>&1 &
PIDS+=($!)
sleep 4

wait_for_url() {
  local url="$1"
  local label="$2"
  for _ in $(seq 1 60); do
    if curl -sf "$url" >/dev/null 2>&1; then
      pass "$label reachable"
      return 0
    fi
    sleep 2
  done
  fail "$label not reachable at $url"
}

echo ""
echo "── Expo web ──"
npm run web >tests/e2e/.web.log 2>&1 &
PIDS+=($!)
wait_for_url "http://localhost:8081" "Expo web"

echo ""
echo "── Playwright ──"
export E2E_ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-E2eAdmin!Test1}"
node <<'NODE'
const { createClient } = require('@supabase/supabase-js');
const url = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
(async () => {
  const { data } = await admin.from('users').select('id').eq('is_admin', true).order('created_at').limit(1).maybeSingle();
  if (!data?.id) return;
  const pwd = process.env.E2E_ADMIN_PASSWORD || 'E2eAdmin!Test1';
  await admin.auth.admin.updateUserById(data.id, { password: pwd });
})();
NODE
set +e
npx playwright test "$@"
PLAY_EXIT=$?
set -e

rm -f "$MERGED_ENV"

echo ""
if [[ "$PLAY_EXIT" -eq 0 ]]; then
  pass "E2E suite passed"
else
  fail "E2E suite failed (exit $PLAY_EXIT) — see tests/e2e/.web.log and tests/e2e/.functions.log"
fi

exit "$PLAY_EXIT"
