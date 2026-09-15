#!/usr/bin/env bash
# Wallet payout draft SQL smoke tests (pgTap when available, basic checks otherwise).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
SQL_FILE="supabase/tests/wallet_payout_draft.sql"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }

if ! command -v psql >/dev/null 2>&1; then
  warn "psql not found — skipping wallet payout SQL tests"
  exit 0
fi

if ! psql "$DB_URL" -c "select 1" >/dev/null 2>&1; then
  warn "Local Postgres not reachable — skipping wallet payout SQL tests"
  exit 0
fi

echo "Wallet payout SQL smoke tests"
echo "============================="

if psql "$DB_URL" -tAc "SELECT 1 FROM pg_extension WHERE extname = 'pgtap'" 2>/dev/null | grep -q 1; then
  echo "Running pgTap suite: $SQL_FILE"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"
  pass "pgTap wallet payout SQL tests"
else
  warn "pgTap extension not installed — running basic SQL checks"

  psql "$DB_URL" -tAc \
    "SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname='public' AND p.proname='save_wallet_payout_draft'" \
    | grep -q 1 || fail "missing function public.save_wallet_payout_draft"
  pass "function public.save_wallet_payout_draft exists"

  psql "$DB_URL" -tAc \
    "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wallets' AND column_name='bank_details'" \
    | grep -q 1 || fail "missing column wallets.bank_details"
  pass "column wallets.bank_details exists"
fi

MIGRATION_COUNT="$(psql "$DB_URL" -tAc \
  "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version IN ('20260704120000','20260704130000')" 2>/dev/null || echo 0)"

if [[ "$MIGRATION_COUNT" == "2" ]]; then
  pass "wallet payout draft migrations applied"
else
  fail "expected migrations 20260704120000 and 20260704130000 (found $MIGRATION_COUNT)"
fi

echo ""
echo -e "${GREEN}Wallet payout SQL smoke tests passed.${NC}"
