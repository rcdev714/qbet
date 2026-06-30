#!/usr/bin/env bash
# Pre-deploy gate for beta approval + web export. Hard-fails on verify; warns on infra checks.
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

WARNINGS=0
PROD_APP_URL="https://anymarkt.com"

echo "Pre-deploy production gate"
echo "=========================="

echo ""
echo "── App verify (typecheck + lint + export + unit tests) ──"
npm run verify
pass "npm run verify"

echo ""
echo "── Supabase migrations (dry-run) ──"
if npx supabase db push --dry-run 2>&1 | tee /tmp/qbet-db-push-dry-run.out; then
  if grep -q "20260626120000_beta_approval_notify" /tmp/qbet-db-push-dry-run.out 2>/dev/null; then
    warn "migration 20260626120000 still pending on remote — run: npx supabase db push"
    WARNINGS=$((WARNINGS + 1))
  else
    pass "beta approval migration appears applied (or not in pending list)"
  fi
else
  warn "supabase db push --dry-run failed (linked project required)"
  WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "── Supabase edge function ──"
if npx supabase functions list 2>/dev/null | grep -q "send-beta-approval-email"; then
  pass "send-beta-approval-email deployed"
else
  warn "send-beta-approval-email not found — run: npx supabase functions deploy send-beta-approval-email"
  WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "── Supabase secrets ──"
SECRETS_OUT="$(npx supabase secrets list 2>/dev/null || true)"
for name in RESEND_API_KEY RESEND_FROM_EMAIL EXPO_PUBLIC_APP_URL; do
  if echo "$SECRETS_OUT" | grep -q "$name"; then
    pass "secret $name set"
  else
    warn "secret $name missing — run: npx supabase secrets set $name=..."
    WARNINGS=$((WARNINGS + 1))
  fi
done

echo ""
echo "── Resend domain (anymarkt.com) ──"
FN_ENV="supabase/functions/.env"
if [[ -f "$FN_ENV" ]] && grep -qE '^RESEND_API_KEY=re_' "$FN_ENV"; then
  RESEND_API_KEY="$(grep '^RESEND_API_KEY=' "$FN_ENV" | cut -d= -f2-)"
  DOMAIN_STATUS="$(curl -s https://api.resend.com/domains \
    -H "Authorization: Bearer $RESEND_API_KEY" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(next((x['status'] for x in d.get('data',[]) if x['name']=='anymarkt.com'), 'missing'))" 2>/dev/null || echo "unknown")"
  if [[ "$DOMAIN_STATUS" == "verified" ]]; then
    pass "anymarkt.com verified in Resend"
  else
    warn "anymarkt.com Resend status: $DOMAIN_STATUS"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  warn "RESEND_API_KEY not in supabase/functions/.env — skipping domain check"
  WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "── Prod welcome link base ──"
echo "    Expected EXPO_PUBLIC_APP_URL secret → $PROD_APP_URL"
echo "    Email from address may remain @anymarkt.com (Resend verified domain)"
warn "Confirm EXPO_PUBLIC_APP_URL Supabase secret matches $PROD_APP_URL before sending prod emails"

echo ""
if [[ "$WARNINGS" -gt 0 ]]; then
  echo -e "${YELLOW}Pre-deploy gate passed verify with ${WARNINGS} infra warning(s).${NC}"
  echo "Fix warnings before production beta approval emails."
else
  echo -e "${GREEN}Pre-deploy gate passed.${NC}"
fi

echo ""
echo "Next steps:"
echo "  1. npx supabase db push"
echo "  2. npx supabase functions deploy send-beta-approval-email"
echo "  3. npm run deploy:web:prod"
echo "  4. Manual smoke: request-access → admin approve → /beta/welcome on $PROD_APP_URL"
