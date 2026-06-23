#!/usr/bin/env bash
# Validate local env for full-stack E2E (Supabase + Stripe + Resend + Playwright).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }

STRICT="${E2E_STRICT:-1}"
issue=0

note_issue() {
  if [[ "$STRICT" == "1" ]]; then
    fail "$1"
  fi
  warn "$1"
  issue=1
}

echo "E2E local environment check"
echo "==========================="

if [[ -f .env ]]; then
  ok ".env exists"
  grep -q 'EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321' .env \
    && ok "App points at local Supabase" \
    || note_issue "EXPO_PUBLIC_SUPABASE_URL should be http://127.0.0.1:54321"
  grep -q 'EXPO_PUBLIC_APP_URL=http://localhost:8081' .env \
    && ok "EXPO_PUBLIC_APP_URL=http://localhost:8081" \
    || note_issue "Set EXPO_PUBLIC_APP_URL=http://localhost:8081 in .env"
  grep -q 'EXPO_PUBLIC_LAUNCH_JURISDICTION=EC' .env \
    && ok "EXPO_PUBLIC_LAUNCH_JURISDICTION=EC" \
    || note_issue "Set EXPO_PUBLIC_LAUNCH_JURISDICTION=EC for EC beta flow"
  grep -qE '^EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_' .env \
    && ok "Stripe publishable key (test) set" \
    || note_issue "Set EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... in .env"
else
  fail ".env missing — copy from .env.example"
fi

FN_ENV="supabase/functions/.env"
if [[ -f "$FN_ENV" ]]; then
  ok "$FN_ENV exists"
  grep -qE '^STRIPE_SECRET_KEY=(sk_test_|"sk_test_)' "$FN_ENV" \
    && ok "STRIPE_SECRET_KEY (test) set" \
    || {
      if command -v stripe >/dev/null 2>&1 \
        && stripe config --list 2>/dev/null | grep -q "test_mode_api_key = 'sk_test_"; then
        ok "STRIPE_SECRET_KEY (test) available via Stripe CLI — run-local-e2e.sh will inject"
      else
        note_issue "Add STRIPE_SECRET_KEY=sk_test_... to $FN_ENV (or log in with Stripe CLI)"
      fi
    }
  grep -qE '^RESEND_API_KEY=re_' "$FN_ENV" \
    && ok "RESEND_API_KEY set" \
    || note_issue "Add RESEND_API_KEY=re_... (use delivered@resend.dev recipients)"
  grep -q 'RESEND_FROM_EMAIL' "$FN_ENV" && ok "RESEND_FROM_EMAIL present" \
    || note_issue "Add RESEND_FROM_EMAIL=AnyMarket <onboarding@resend.dev>"
  grep -q 'EXPO_PUBLIC_APP_URL=http://localhost:8081' "$FN_ENV" \
    && ok "Functions EXPO_PUBLIC_APP_URL set" \
    || note_issue "Add EXPO_PUBLIC_APP_URL=http://localhost:8081 to $FN_ENV"
  if grep -qE '^STRIPE_WEBHOOK_SECRET=whsec_' "$FN_ENV" \
    || { [[ -f tests/e2e/.stripe-secrets.env ]] \
      && grep -qE '^STRIPE_WEBHOOK_SECRET=whsec_' tests/e2e/.stripe-secrets.env; }; then
    ok "STRIPE_WEBHOOK_SECRET present"
  else
    note_issue "STRIPE_WEBHOOK_SECRET missing — run scripts/stripe-e2e-listen.sh first"
  fi
  if grep -qE '^STRIPE_IDENTITY_WEBHOOK_SECRET=whsec_' "$FN_ENV" \
    || { [[ -f tests/e2e/.stripe-secrets.env ]] \
      && grep -qE '^STRIPE_IDENTITY_WEBHOOK_SECRET=whsec_' tests/e2e/.stripe-secrets.env; }; then
    ok "STRIPE_IDENTITY_WEBHOOK_SECRET present"
  else
    note_issue "STRIPE_IDENTITY_WEBHOOK_SECRET missing — run scripts/stripe-e2e-listen.sh first"
  fi
else
  fail "$FN_ENV missing — copy from supabase/functions/.env.example"
fi

echo ""
echo "Supabase local"
if npx supabase status >/dev/null 2>&1; then
  ok "Supabase running"
else
  fail "Run: npx supabase start"
fi

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

echo ""
echo "Migrations"
REQUIRED_MIGRATIONS=(
  20260625120000
  20260626120000
  20260627140000
  20260627150000
  20260627150100
  20260628120000
  20260628130000
  20260628140000
  20260628150000
  20260628160000
  20260628170000
)
for version in "${REQUIRED_MIGRATIONS[@]}"; do
  if psql "$DB_URL" -tAc \
    "SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '$version'" 2>/dev/null | grep -q 1; then
    ok "migration $version applied"
  else
    note_issue "Missing migration $version — run: npx supabase migration up --local"
  fi
done

echo ""
echo "Admin user"
ADMIN_COUNT="$(psql "$DB_URL" -tAc "SELECT count(*) FROM public.users WHERE is_admin = true" 2>/dev/null || echo 0)"
if [[ "$ADMIN_COUNT" -ge 1 ]]; then
  ok "admin user exists ($ADMIN_COUNT)"
else
  note_issue "No admin user — sign up locally then: update public.users set is_admin = true where email = 'you@example.com';"
fi

echo ""
echo "Tooling"
if command -v stripe >/dev/null 2>&1; then
  ok "Stripe CLI ($(stripe --version 2>/dev/null | head -1))"
else
  note_issue "Stripe CLI not installed — https://stripe.com/docs/stripe-cli"
fi

if [[ -d node_modules/@playwright/test ]]; then
  ok "@playwright/test installed"
else
  note_issue "Run: npm install && npx playwright install chromium"
fi

echo ""
if [[ "$issue" -eq 0 ]]; then
  echo -e "${GREEN}E2E environment looks ready.${NC}"
else
  echo -e "${YELLOW}E2E environment has warnings (E2E_STRICT=0 to allow).${NC}"
fi
