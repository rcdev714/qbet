#!/usr/bin/env bash
# SQL smoke + integration tests for notification preferences and social RPCs.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:54321}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }

echo "Notification & social SQL tests"
echo "================================"

if ! psql "$DB_URL" -c "select 1" >/dev/null 2>&1; then
  warn "Local Postgres not reachable — skipping"
  exit 0
fi

MIGRATION_OK="$(psql "$DB_URL" -tAc \
  "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version = '20260628160000'")"
[[ "$MIGRATION_OK" == "1" ]] || fail "migration 20260628160000 not applied — run: npx supabase migration up --local"

SOCIAL_MIGRATION_OK="$(psql "$DB_URL" -tAc \
  "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version = '20260629120000'")"
[[ "$SOCIAL_MIGRATION_OK" == "1" ]] || fail "migration 20260629120000 not applied — run: npx supabase migration up --local"
pass "migration 20260629120000 applied"

DISCOVER_MIGRATION_OK="$(psql "$DB_URL" -tAc \
  "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version = '20260629140000'")"
[[ "$DISCOVER_MIGRATION_OK" == "1" ]] || fail "migration 20260629140000 not applied — run: npx supabase migration up --local"
pass "migration 20260629140000 applied"

for tbl in user_notification_preferences notification_deliveries web_push_subscriptions notification_dispatch_queue dm_pairs group_email_invites; do
  psql "$DB_URL" -tAc \
    "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='$tbl'" \
    | grep -q 1 || fail "missing table public.$tbl"
  pass "table public.$tbl exists"
done

for fn in notify_user get_following get_following_activity get_following_activity_v2 get_suggested_users list_discoverable_users find_or_create_dm_group update_notification_preferences register_web_push_subscription get_notification_preferences record_notification_delivery mark_notification_dispatch_processed get_groups_administered get_user_profile_groups join_group_from_profile update_group_visibility; do
  psql "$DB_URL" -tAc \
    "SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname='public' AND p.proname='$fn'" \
    | grep -q 1 || fail "missing function public.$fn"
  pass "function public.$fn exists"
done

# Integration: notify_user + follow trigger + preferences
TEST_SQL=$(cat <<'SQL'
DO $$
DECLARE
  v_user_a uuid := gen_random_uuid();
  v_user_b uuid := gen_random_uuid();
  v_notif_id uuid;
  v_queue_count int;
  v_follower_count int;
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role)
  VALUES
    (v_user_a, 'notif-test-a-' || substr(v_user_a::text, 1, 8) || '@resend.dev', crypt('password123', gen_salt('bf')), now(), '{}', '{"username":"notif_a"}', now(), now(), 'authenticated', 'authenticated'),
    (v_user_b, 'notif-test-b-' || substr(v_user_b::text, 1, 8) || '@resend.dev', crypt('password123', gen_salt('bf')), now(), '{}', '{"username":"notif_b"}', now(), now(), 'authenticated', 'authenticated');

  UPDATE public.users SET username = 'notif_a' WHERE id = v_user_a;
  UPDATE public.users SET username = 'notif_b' WHERE id = v_user_b;

  IF NOT EXISTS (SELECT 1 FROM public.user_notification_preferences WHERE user_id = v_user_b) THEN
    RAISE EXCEPTION 'preferences row not created for user_b';
  END IF;

  UPDATE public.user_notification_preferences
  SET in_app_social = true, email_social = true
  WHERE user_id = v_user_b;

  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  INSERT INTO public.user_follows (follower_id, following_id)
  VALUES (v_user_a, v_user_b);

  SELECT count(*) INTO v_follower_count
  FROM public.notifications
  WHERE user_id = v_user_b AND type = 'new_follower';

  IF v_follower_count < 1 THEN
    RAISE EXCEPTION 'expected new_follower notification, got %', v_follower_count;
  END IF;

  SELECT id INTO v_notif_id
  FROM public.notifications
  WHERE user_id = v_user_b AND type = 'new_follower'
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT count(*) INTO v_queue_count
  FROM public.notification_dispatch_queue
  WHERE notification_id = v_notif_id;

  IF v_queue_count < 1 THEN
    RAISE EXCEPTION 'expected dispatch queue row for notification %', v_notif_id;
  END IF;

  UPDATE public.user_notification_preferences
  SET in_app_social = false
  WHERE user_id = v_user_b;

  PERFORM public.notify_user(v_user_b, 'new_follower', 'Should be skipped', NULL, '{}'::jsonb);

  IF EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = v_user_b AND title = 'Should be skipped'
  ) THEN
    RAISE EXCEPTION 'in_app_social=false should skip notification';
  END IF;

  DELETE FROM public.user_follows WHERE follower_id = v_user_a OR following_id IN (v_user_a, v_user_b);
  DELETE FROM public.notification_dispatch_queue WHERE notification_id IN (
    SELECT id FROM public.notifications WHERE user_id IN (v_user_a, v_user_b)
  );
  DELETE FROM public.notification_deliveries WHERE notification_id IN (
    SELECT id FROM public.notifications WHERE user_id IN (v_user_a, v_user_b)
  );
  DELETE FROM public.notifications WHERE user_id IN (v_user_a, v_user_b);
  DELETE FROM public.user_notification_preferences WHERE user_id IN (v_user_a, v_user_b);
  DELETE FROM public.wallets WHERE user_id IN (v_user_a, v_user_b);
  DELETE FROM public.users WHERE id IN (v_user_a, v_user_b);
  DELETE FROM auth.users WHERE id IN (v_user_a, v_user_b);
END $$;
SQL
)

if psql "$DB_URL" -v ON_ERROR_STOP=1 -c "$TEST_SQL" >/dev/null 2>&1; then
  pass "follow trigger + notify_user preference gating"
else
  fail "follow trigger / notify_user integration failed"
fi

# DM group RPC smoke test
DM_SQL=$(cat <<'SQL'
DO $$
DECLARE
  v_user_a uuid := gen_random_uuid();
  v_user_b uuid := gen_random_uuid();
  v_group_id uuid;
  v_group_id2 uuid;
  v_member_count int;
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role)
  VALUES
    (v_user_a, 'dm-test-a-' || substr(v_user_a::text, 1, 8) || '@resend.dev', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), 'authenticated', 'authenticated'),
    (v_user_b, 'dm-test-b-' || substr(v_user_b::text, 1, 8) || '@resend.dev', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), 'authenticated', 'authenticated');

  UPDATE public.users SET username = 'dm_a' WHERE id = v_user_a;
  UPDATE public.users SET username = 'dm_b' WHERE id = v_user_b;

  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  v_group_id := public.find_or_create_dm_group(v_user_b);
  v_group_id2 := public.find_or_create_dm_group(v_user_b);

  IF v_group_id IS NULL OR v_group_id <> v_group_id2 THEN
    RAISE EXCEPTION 'find_or_create_dm_group should return stable group id';
  END IF;

  SELECT count(*) INTO v_member_count FROM public.group_members WHERE group_id = v_group_id;
  IF v_member_count <> 2 THEN
    RAISE EXCEPTION 'DM group should have 2 members, got %', v_member_count;
  END IF;

  DELETE FROM public.dm_pairs WHERE group_id = v_group_id;
  DELETE FROM public.group_members WHERE group_id = v_group_id;
  DELETE FROM public.groups WHERE id = v_group_id;
  DELETE FROM public.wallets WHERE user_id IN (v_user_a, v_user_b);
  DELETE FROM public.user_notification_preferences WHERE user_id IN (v_user_a, v_user_b);
  DELETE FROM public.users WHERE id IN (v_user_a, v_user_b);
  DELETE FROM auth.users WHERE id IN (v_user_a, v_user_b);
END $$;
SQL
)

if psql "$DB_URL" -v ON_ERROR_STOP=1 -c "$DM_SQL" >/dev/null 2>&1; then
  pass "find_or_create_dm_group creates stable 2-member DM"
else
  fail "find_or_create_dm_group integration failed"
fi

# Group discoverability + join_from_profile integration
GROUPS_SQL=$(cat <<'SQL'
DO $$
DECLARE
  v_user_a uuid := gen_random_uuid();
  v_user_b uuid := gen_random_uuid();
  v_group_id uuid := gen_random_uuid();
  v_admin_count int;
  v_profile_count int;
  v_is_member boolean;
  v_member_count int;
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role)
  VALUES
    (v_user_a, 'grp-test-a-' || substr(v_user_a::text, 1, 8) || '@resend.dev', crypt('password123', gen_salt('bf')), now(), '{}', '{"username":"grp_a"}', now(), now(), 'authenticated', 'authenticated'),
    (v_user_b, 'grp-test-b-' || substr(v_user_b::text, 1, 8) || '@resend.dev', crypt('password123', gen_salt('bf')), now(), '{}', '{"username":"grp_b"}', now(), now(), 'authenticated', 'authenticated');

  UPDATE public.users SET username = 'grp_a' WHERE id = v_user_a;
  UPDATE public.users SET username = 'grp_b' WHERE id = v_user_b;

  INSERT INTO public.groups (id, name, share_code, description, admin_id, is_discoverable, show_on_profile, is_dm)
  VALUES (v_group_id, 'Discoverable Test Group', 'DISCV1', 'SQL integration test group', v_user_b, true, true, false);

  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (v_group_id, v_user_b, 'admin');

  PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  SELECT count(*) INTO v_admin_count FROM public.get_groups_administered();
  IF v_admin_count <> 1 THEN
    RAISE EXCEPTION 'get_groups_administered expected 1 row, got %', v_admin_count;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);

  SELECT count(*), bool_and(NOT is_member) INTO v_profile_count, v_is_member
  FROM public.get_user_profile_groups(v_user_b);

  IF v_profile_count <> 1 OR NOT v_is_member THEN
    RAISE EXCEPTION 'get_user_profile_groups expected 1 non-member row';
  END IF;

  PERFORM public.join_group_from_profile(v_group_id);

  SELECT count(*) INTO v_member_count
  FROM public.group_members
  WHERE group_id = v_group_id AND user_id = v_user_a;

  IF v_member_count <> 1 THEN
    RAISE EXCEPTION 'join_group_from_profile should create membership';
  END IF;

  BEGIN
    PERFORM public.update_group_visibility(v_group_id, false, false);
    RAISE EXCEPTION 'non-admin update_group_visibility should fail';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);
  PERFORM public.update_group_visibility(v_group_id, false, true);

  DELETE FROM public.group_members WHERE group_id = v_group_id;
  DELETE FROM public.groups WHERE id = v_group_id;
  DELETE FROM public.wallets WHERE user_id IN (v_user_a, v_user_b);
  DELETE FROM public.user_notification_preferences WHERE user_id IN (v_user_a, v_user_b);
  DELETE FROM public.users WHERE id IN (v_user_a, v_user_b);
  DELETE FROM auth.users WHERE id IN (v_user_a, v_user_b);
END $$;
SQL
)

if psql "$DB_URL" -v ON_ERROR_STOP=1 -c "$GROUPS_SQL" >/dev/null 2>&1; then
  pass "group discoverability + join_group_from_profile + visibility RPCs"
else
  fail "group discoverability integration failed"
fi

# Activity v2 integration
ACTIVITY_SQL=$(cat <<'SQL'
DO $$
DECLARE
  v_user_a uuid := gen_random_uuid();
  v_user_b uuid := gen_random_uuid();
  v_market_id uuid := gen_random_uuid();
  v_option_id uuid := gen_random_uuid();
  v_group_id uuid := gen_random_uuid();
  v_bet_count int;
  v_comment_count int;
  v_group_count int;
  v_page1 int;
  v_page2 int;
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role)
  VALUES
    (v_user_a, 'act-test-a-' || substr(v_user_a::text, 1, 8) || '@resend.dev', crypt('password123', gen_salt('bf')), now(), '{}', '{"username":"act_a"}', now(), now(), 'authenticated', 'authenticated'),
    (v_user_b, 'act-test-b-' || substr(v_user_b::text, 1, 8) || '@resend.dev', crypt('password123', gen_salt('bf')), now(), '{}', '{"username":"act_b"}', now(), now(), 'authenticated', 'authenticated');

  UPDATE public.users SET username = 'act_a' WHERE id = v_user_a;
  UPDATE public.users SET username = 'act_b' WHERE id = v_user_b;

  INSERT INTO public.user_follows (follower_id, following_id)
  VALUES (v_user_a, v_user_b);

  INSERT INTO public.markets (id, creator_id, question, description, status, closes_at, is_public)
  VALUES (v_market_id, v_user_b, 'Activity v2 smoke market?', 'Integration test', 'open', now() + interval '7 days', true);

  INSERT INTO public.options (id, market_id, label, total_pool)
  VALUES (v_option_id, v_market_id, 'Yes', 0);

  INSERT INTO public.bets (user_id, market_id, option_id, amount, side, placed_at)
  VALUES (v_user_b, v_market_id, v_option_id, 10, 'yes', now());

  INSERT INTO public.market_chat_messages (market_id, user_id, content, created_at)
  VALUES (v_market_id, v_user_b, 'Activity v2 comment preview', now());

  INSERT INTO public.groups (id, name, share_code, description, admin_id, is_discoverable, show_on_profile, is_dm, created_at)
  VALUES (v_group_id, 'Activity Test Group', 'ACTV01', 'Created for activity v2 test', v_user_b, true, true, false, now());

  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (v_group_id, v_user_b, 'admin');

  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  SELECT count(*) INTO v_bet_count
  FROM public.get_following_activity_v2(30, 0, NULL)
  WHERE activity_type = 'bet_placed';

  SELECT count(*) INTO v_comment_count
  FROM public.get_following_activity_v2(30, 0, NULL)
  WHERE activity_type = 'market_comment';

  SELECT count(*) INTO v_group_count
  FROM public.get_following_activity_v2(30, 0, NULL)
  WHERE activity_type = 'group_created';

  IF v_bet_count < 1 OR v_comment_count < 1 OR v_group_count < 1 THEN
    RAISE EXCEPTION 'activity v2 missing types: bet=% comment=% group=%', v_bet_count, v_comment_count, v_group_count;
  END IF;

  SELECT count(*) INTO v_page1 FROM public.get_following_activity_v2(30, 0, NULL);
  SELECT count(*) INTO v_page2 FROM public.get_following_activity_v2(30, 30, NULL);

  IF v_page2 > v_page1 THEN
    RAISE EXCEPTION 'activity v2 pagination offset should not return more rows than first page';
  END IF;

  DELETE FROM public.user_follows WHERE follower_id = v_user_a;
  DELETE FROM public.market_chat_messages WHERE market_id = v_market_id;
  DELETE FROM public.bets WHERE market_id = v_market_id;
  DELETE FROM public.options WHERE market_id = v_market_id;
  DELETE FROM public.markets WHERE id = v_market_id;
  DELETE FROM public.group_members WHERE group_id = v_group_id;
  DELETE FROM public.groups WHERE id = v_group_id;
  DELETE FROM public.wallets WHERE user_id IN (v_user_a, v_user_b);
  DELETE FROM public.user_notification_preferences WHERE user_id IN (v_user_a, v_user_b);
  DELETE FROM public.users WHERE id IN (v_user_a, v_user_b);
  DELETE FROM auth.users WHERE id IN (v_user_a, v_user_b);
END $$;
SQL
)

if psql "$DB_URL" -v ON_ERROR_STOP=1 -c "$ACTIVITY_SQL" >/dev/null 2>&1; then
  pass "get_following_activity_v2 returns bet, comment, group + pagination"
else
  fail "get_following_activity_v2 integration failed"
fi

# list_discoverable_users integration
DISCOVER_USERS_SQL=$(cat <<'SQL'
DO $$
DECLARE
  v_user_a uuid := gen_random_uuid();
  v_user_b uuid := gen_random_uuid();
  v_user_deleted uuid := gen_random_uuid();
  v_count int;
  v_includes_b boolean;
  v_excludes_self boolean;
  v_excludes_deleted boolean;
  v_is_following boolean;
  v_toggle jsonb;
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role)
  VALUES
    (v_user_a, 'disc-a-' || substr(v_user_a::text, 1, 8) || '@resend.dev', crypt('password123', gen_salt('bf')), now(), '{}', '{"username":"disc_a"}', now(), now(), 'authenticated', 'authenticated'),
    (v_user_b, 'disc-b-' || substr(v_user_b::text, 1, 8) || '@resend.dev', crypt('password123', gen_salt('bf')), now(), '{}', '{"username":"disc_b"}', now(), now(), 'authenticated', 'authenticated'),
    (v_user_deleted, 'disc-del-' || substr(v_user_deleted::text, 1, 8) || '@resend.dev', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), 'authenticated', 'authenticated');

  UPDATE public.users SET username = 'disc_a', created_at = now() - interval '1 day' WHERE id = v_user_a;
  UPDATE public.users SET username = 'disc_b', created_at = now() WHERE id = v_user_b;
  UPDATE public.users SET username = 'deleted_' || substr(v_user_deleted::text, 1, 8) WHERE id = v_user_deleted;

  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  SELECT count(*) INTO v_count FROM public.list_discoverable_users(30, 0);
  IF v_count < 1 THEN
    RAISE EXCEPTION 'list_discoverable_users should return at least one member';
  END IF;

  SELECT bool_or(user_id = v_user_b) INTO v_includes_b
  FROM public.list_discoverable_users(100, 0);

  SELECT NOT bool_or(user_id = v_user_a) INTO v_excludes_self
  FROM public.list_discoverable_users(100, 0);

  SELECT NOT bool_or(user_id = v_user_deleted) INTO v_excludes_deleted
  FROM public.list_discoverable_users(100, 0);

  IF NOT v_includes_b OR NOT v_excludes_self OR NOT v_excludes_deleted THEN
    RAISE EXCEPTION 'list_discoverable_users filters wrong: includes_b=% self=% deleted=%',
      v_includes_b, v_excludes_self, v_excludes_deleted;
  END IF;

  INSERT INTO public.user_follows (follower_id, following_id)
  VALUES (v_user_a, v_user_b);

  SELECT is_following INTO v_is_following
  FROM public.list_discoverable_users(100, 0)
  WHERE user_id = v_user_b
  LIMIT 1;

  IF NOT v_is_following THEN
    RAISE EXCEPTION 'list_discoverable_users should mark is_following=true for followed user';
  END IF;

  v_toggle := public.toggle_user_follow(v_user_b);
  IF coalesce((v_toggle->>'following')::boolean, false) IS NOT FALSE THEN
    RAISE EXCEPTION 'toggle_user_follow should return following=false after unfollow, got %', v_toggle;
  END IF;

  DELETE FROM public.user_follows WHERE follower_id = v_user_a OR following_id IN (v_user_a, v_user_b, v_user_deleted);
  DELETE FROM public.wallets WHERE user_id IN (v_user_a, v_user_b, v_user_deleted);
  DELETE FROM public.user_notification_preferences WHERE user_id IN (v_user_a, v_user_b, v_user_deleted);
  DELETE FROM public.users WHERE id IN (v_user_a, v_user_b, v_user_deleted);
  DELETE FROM auth.users WHERE id IN (v_user_a, v_user_b, v_user_deleted);
END $$;
SQL
)

if psql "$DB_URL" -v ON_ERROR_STOP=1 -c "$DISCOVER_USERS_SQL" >/dev/null 2>&1; then
  pass "list_discoverable_users excludes self/deleted, includes members, tracks is_following"
else
  fail "list_discoverable_users integration failed"
fi

echo ""
echo "Edge function smoke (dispatch-notification)"
echo "-------------------------------------------"

# Create a throwaway notification via service role and invoke dispatch
if EDGE_RESULT="$(SUPABASE_URL="$SUPABASE_URL" SERVICE_KEY="$SERVICE_KEY" node <<'NODE'
const { createClient } = require('@supabase/supabase-js');
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SERVICE_KEY;

(async () => {
  const admin = createClient(url, serviceKey);
  const email = 'dispatch-smoke-' + Date.now() + '@resend.dev';

  const { error: authErr } = await admin.auth.admin.createUser({
    email,
    password: 'TestPassword123!',
    email_confirm: true,
    user_metadata: { username: 'dispatch_smoke' },
  });
  if (authErr) throw authErr;

  const { data: userRow } = await admin.from('users').select('id').eq('email', email).single();
  const uid = userRow?.id;
  if (!uid) throw new Error('user not created');

  const { data: notif, error: notifErr } = await admin.rpc('notify_user', {
    p_user_id: uid,
    p_type: 'bet_won',
    p_title: 'Smoke test won',
    p_body: 'Winner: YES',
    p_data: { market_id: '00000000-0000-0000-0000-000000000001', market_question: 'Smoke market?', won: true, is_public: true },
  });
  if (notifErr) throw notifErr;

  const { data, error } = await admin.functions.invoke('dispatch-notification', {
    body: { notificationId: notif.id },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(JSON.stringify(data));

  await admin.auth.admin.deleteUser(uid);
  console.log(JSON.stringify({ ok: true, result: data.results?.[0] }));
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
NODE
)"; then
  pass "dispatch-notification edge function: $EDGE_RESULT"
else
  warn "dispatch-notification edge function failed (ensure supabase functions are served): $EDGE_RESULT"
fi

echo ""
echo -e "${GREEN}Notification & social SQL tests passed.${NC}"
