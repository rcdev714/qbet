#!/usr/bin/env bash
# Bet contract SQL smoke tests (pgTap when available, basic checks otherwise).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }

if ! command -v psql >/dev/null 2>&1; then
  warn "psql not found — skipping bet contract SQL tests"
  exit 0
fi

if ! psql "$DB_URL" -c "select 1" >/dev/null 2>&1; then
  if [[ "${INTEGRATION_STRICT:-0}" == "1" ]]; then
    fail "Local Postgres not reachable (INTEGRATION_STRICT=1)"
  fi
  warn "Local Postgres not reachable — skipping bet contract SQL tests"
  exit 0
fi

echo "Bet contract SQL smoke tests"
echo "============================"

MIGRATION_COUNT="$(psql "$DB_URL" -tAc \
  "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version IN ('20260627150000','20260627150100','20260627150200')" 2>/dev/null || echo 0)"

if [[ "$MIGRATION_COUNT" == "3" ]]; then
  pass "bet contract migrations applied (3/3)"
else
  fail "expected bet contract migrations 20260627150000–50200 (found $MIGRATION_COUNT/3)"
fi

psql "$DB_URL" -tAc \
  "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bet_contracts'" \
  | grep -q 1 || fail "missing table public.bet_contracts"
pass "table public.bet_contracts exists"

for col in placed_snapshot resolved_snapshot placed_email_sent_at resolved_email_sent_at contract_number; do
  psql "$DB_URL" -tAc \
    "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bet_contracts' AND column_name='$col'" \
    | grep -q 1 || fail "missing column bet_contracts.$col"
  pass "column bet_contracts.$col exists"
done

for fn in create_bet_contract_on_insert update_bet_contracts_on_resolution get_bet_contract_by_bet_id mark_bet_contract_email_sent build_bet_contract_number; do
  psql "$DB_URL" -tAc \
    "SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname='public' AND p.proname='$fn'" \
    | grep -q 1 || fail "missing function public.$fn"
  pass "function public.$fn exists"
done

psql "$DB_URL" -tAc \
  "SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bet_contracts' AND policyname='Users can view own bet contracts'" \
  | grep -q 1 || fail "missing RLS policy on bet_contracts"
pass "RLS policy Users can view own bet contracts exists"

echo ""
echo -e "${GREEN}Bet contract SQL smoke tests passed.${NC}"
