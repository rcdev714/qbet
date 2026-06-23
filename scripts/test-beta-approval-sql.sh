#!/usr/bin/env bash
# Run beta approval SQL smoke tests (pgTap when available, basic checks otherwise).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
SQL_FILE="supabase/tests/beta_approval_notify.sql"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }

if ! command -v psql >/dev/null 2>&1; then
  warn "psql not found — skipping beta approval SQL tests"
  exit 0
fi

if ! psql "$DB_URL" -c "select 1" >/dev/null 2>&1; then
  warn "Local Postgres not reachable — skipping beta approval SQL tests"
  exit 0
fi

echo "Beta approval SQL smoke tests"
echo "=============================="

if psql "$DB_URL" -tAc "SELECT 1 FROM pg_extension WHERE extname = 'pgtap'" 2>/dev/null | grep -q 1; then
  echo "Running pgTap suite: $SQL_FILE"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"
  pass "pgTap beta approval SQL tests"
else
  warn "pgTap extension not installed — running basic SQL checks"

  for col in approval_token approval_email_sent_at; do
    psql "$DB_URL" -tAc \
      "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='beta_access_requests' AND column_name='$col'" \
      | grep -q 1 || fail "missing column beta_access_requests.$col"
    pass "column beta_access_requests.$col exists"
  done

  for fn in resolve_beta_approval_token mark_beta_approval_email_sent approve_beta_access_request; do
    psql "$DB_URL" -tAc \
      "SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname='public' AND p.proname='$fn'" \
      | grep -q 1 || fail "missing function public.$fn"
    pass "function public.$fn exists"
  done
fi

MIGRATION_COUNT="$(psql "$DB_URL" -tAc \
  "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version IN ('20260625120000','20260626120000')" 2>/dev/null || echo 0)"

if [[ "$MIGRATION_COUNT" == "2" ]]; then
  pass "beta access migrations applied"
else
  fail "expected migrations 20260625120000 and 20260626120000 (found $MIGRATION_COUNT)"
fi

echo ""
echo -e "${GREEN}Beta approval SQL smoke tests passed.${NC}"
