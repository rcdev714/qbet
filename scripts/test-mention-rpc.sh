#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env.local && ! -f .env ]]; then
  echo "Missing .env.local — copy from .env.example for local RPC smoke tests."
  exit 1
fi

# shellcheck disable=SC1091
source scripts/check-e2e-local-env.sh 2>/dev/null || true

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  v_user uuid;
  v_group uuid;
BEGIN
  SELECT id INTO v_user FROM auth.users LIMIT 1;
  IF v_user IS NULL THEN
    RAISE NOTICE 'Skipping mention RPC smoke — no auth.users rows';
    RETURN;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  IF to_regprocedure('public.search_mention_users(text,uuid,int)') IS NULL THEN
    RAISE EXCEPTION 'search_mention_users migration not applied';
  END IF;

  PERFORM * FROM public.search_mention_users('', NULL, 5);
  PERFORM * FROM public.search_mention_groups('', 5);

  SELECT g.id INTO v_group
  FROM public.groups g
  WHERE coalesce(g.is_dm, false) = false
  LIMIT 1;

  IF v_group IS NOT NULL THEN
    PERFORM public.get_mention_card_group(v_group);
  END IF;

  PERFORM public.get_mention_card_profile(v_user);
END $$;
SQL

echo "mention RPC smoke checks passed"
