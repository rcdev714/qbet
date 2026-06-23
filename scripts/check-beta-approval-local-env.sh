#!/usr/bin/env bash
# Validate local env for beta approval email flow.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; }

echo "Beta approval — local env check"
echo "================================"

# App .env
if [[ -f .env ]]; then
  ok ".env exists"
  grep -q 'EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321' .env && ok "App points at local Supabase" || warn "EXPO_PUBLIC_SUPABASE_URL should be http://127.0.0.1:54321 for local"
  grep -q 'EXPO_PUBLIC_APP_URL=http://localhost:8081' .env && ok "EXPO_PUBLIC_APP_URL=http://localhost:8081" || warn "Set EXPO_PUBLIC_APP_URL=http://localhost:8081 in .env"
else
  fail ".env missing — copy from .env.example"
fi

# Functions .env
FN_ENV="supabase/functions/.env"
if [[ -f "$FN_ENV" ]]; then
  ok "$FN_ENV exists"
  if grep -qE '^RESEND_API_KEY=re_' "$FN_ENV"; then
    ok "RESEND_API_KEY is set"
  else
    warn "RESEND_API_KEY empty — add your key from https://resend.com/api-keys"
    echo "    Edit: supabase/functions/.env"
    echo "    RESEND_API_KEY=re_..."
    echo "    Then restart: npx supabase functions serve send-beta-approval-email --env-file supabase/functions/.env"
  fi
  grep -q 'RESEND_FROM_EMAIL' "$FN_ENV" && ok "RESEND_FROM_EMAIL present" || warn "Add RESEND_FROM_EMAIL=AnyMarket <onboarding@resend.dev>"
  grep -q 'EXPO_PUBLIC_APP_URL=http://localhost:8081' "$FN_ENV" && ok "Functions EXPO_PUBLIC_APP_URL set" || warn "Add EXPO_PUBLIC_APP_URL=http://localhost:8081 to $FN_ENV"
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

echo ""
echo "Migrations (beta access + approval notify)"
if psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -tAc \
  "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version IN ('20260625120000','20260626120000');" 2>/dev/null | grep -q '^2$'; then
  ok "Both beta migrations applied"
else
  warn "Run: npx supabase migration up --local"
fi

echo ""
echo "Quick test (no email)"
echo "  1. npm run web"
echo "  2. npx supabase functions serve send-beta-approval-email --env-file supabase/functions/.env"
echo "  3. /request-access → admin approve → or use Studio approval_token"
echo "  4. Open /beta/welcome?token=<uuid>"
echo ""
echo "With Resend key, use recipient delivered@resend.dev for test sends."
