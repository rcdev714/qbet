#!/usr/bin/env bash
# Fast local health + sanity checks. Full deploy gate: npm run verify
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

step() {
  echo ""
  echo "── $1 ──"
}

WARNINGS=0

step "TypeScript"
npm run typecheck --silent
pass "typecheck"

step "ESLint"
set +e
npm run lint 2>&1 | tee /tmp/qbet-lint.out
LINT_EXIT=$?
set -e
if [[ "$LINT_EXIT" -ne 0 ]]; then
  fail "lint errors (see above)"
fi
if grep -q "warning" /tmp/qbet-lint.out; then
  warn "lint warnings present (non-blocking)"
  WARNINGS=$((WARNINGS + 1))
else
  pass "lint (no warnings)"
fi

step "Unit tests"
npm run test --silent
pass "unit tests"

if command -v deno >/dev/null 2>&1; then
  step "Beta approval email helpers (Deno)"
  npm run test:beta-approval-email --silent
  pass "beta-approval-email Deno tests"
else
  warn "deno not installed — skipping test:beta-approval-email"
  WARNINGS=$((WARNINGS + 1))
fi

step "Policy hashes"
npm run policy:hashes --silent >/dev/null
pass "policy hash generation"

step "React hooks order"
npx tsx scripts/check-hooks-order.ts
pass "no hooks-after-early-return violations"

step "Environment"
REQUIRED=(
  EXPO_PUBLIC_SUPABASE_URL
  EXPO_PUBLIC_SUPABASE_KEY
  EXPO_PUBLIC_APP_URL
  EXPO_PUBLIC_LAUNCH_JURISDICTION
  EXPO_PUBLIC_BETA_REQUIRED
)
if [[ ! -f .env ]]; then
  warn ".env missing — copy from .env.example"
  WARNINGS=$((WARNINGS + 1))
else
  for var in "${REQUIRED[@]}"; do
    if ! grep -q "^${var}=." .env 2>/dev/null; then
      warn ".env: ${var} is missing or empty"
      WARNINGS=$((WARNINGS + 1))
    fi
  done
  pass ".env required keys present"
fi

if command -v npx >/dev/null 2>&1 && npx supabase status >/dev/null 2>&1; then
  step "Local Supabase"
  pass "supabase local is running"
  if [[ -f .env ]]; then
    ENV_URL="$(grep '^EXPO_PUBLIC_SUPABASE_URL=' .env | cut -d= -f2- | tr -d '"')"
    if [[ "$ENV_URL" != "http://127.0.0.1:54321" && "$ENV_URL" != "http://localhost:54321" ]]; then
      warn ".env SUPABASE_URL ($ENV_URL) does not point at local Supabase"
      WARNINGS=$((WARNINGS + 1))
    fi
  fi
  step "Beta approval SQL smoke"
  bash scripts/test-beta-approval-sql.sh
  pass "beta approval SQL smoke"
  step "Beta approval local env"
  bash scripts/check-beta-approval-local-env.sh || WARNINGS=$((WARNINGS + 1))
else
  step "Local Supabase"
  warn "supabase not running locally (optional for frontend-only work)"
  WARNINGS=$((WARNINGS + 1))
fi

echo ""
if [[ "$WARNINGS" -gt 0 ]]; then
  echo -e "${YELLOW}Health check passed with ${WARNINGS} warning(s).${NC}"
  echo "Run npm run verify for full web export gate before deploy."
else
  echo -e "${GREEN}All health checks passed.${NC}"
  echo "Run npm run verify for full web export gate before deploy."
fi
