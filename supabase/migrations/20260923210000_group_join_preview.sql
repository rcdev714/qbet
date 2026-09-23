-- Join preview for the phone create/join sheets.
--
-- groups.visibility (web public | discoverable | private) is not added here.
-- Expo keeps is_discoverable + show_on_profile. The client maps:
--   on profile  -> both true
--   invite only -> both false
--
-- Re-joining with a code must not demote an admin. The previous
-- join_group_by_code updated role to 'member' on conflict.
-- Wallet inserts stay at 0 real balance. RLS policies are unchanged.
-- Preview is security definer because groups SELECT is member-or-admin,
-- so a non-member cannot read a group (or its share code) to render a card.

CREATE OR REPLACE FUNCTION public.join_group_by_code(p_code text)
 RETURNS group_members
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_group_id UUID;
  v_membership public.group_members;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Ensure the user exists in the public.users table (lazy creation if trigger failed)
  INSERT INTO public.users (id)
  VALUES (v_user_id)
  ON CONFLICT (id) DO NOTHING;

  -- Ensure the user has a wallet with 0 real balance (play_balance defaults to 1000)
  INSERT INTO public.wallets (user_id, balance)
  VALUES (v_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Find the group (RLS is bypassed because of SECURITY DEFINER)
  SELECT id INTO v_group_id FROM public.groups WHERE UPPER(share_code) = UPPER(TRIM(p_code));

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Group not found';
  END IF;

  -- Join the group. An existing membership keeps its role.
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (v_group_id, v_user_id, 'member')
  ON CONFLICT (group_id, user_id) DO NOTHING
  RETURNING * INTO v_membership;

  IF NOT FOUND THEN
    SELECT *
    INTO v_membership
    FROM public.group_members
    WHERE group_id = v_group_id
      AND user_id = v_user_id;
  END IF;

  RETURN v_membership;
END;
$function$;

CREATE OR REPLACE FUNCTION public.preview_group_by_code(p_code text)
RETURNS TABLE (
  group_id uuid,
  name text,
  description text,
  avatar_url text,
  member_count bigint,
  is_member boolean,
  is_discoverable boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_code IS NULL OR char_length(trim(p_code)) <> 6 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    g.id,
    g.name,
    g.description,
    g.avatar_url,
    (
      SELECT count(*)::bigint
      FROM public.group_members gm
      WHERE gm.group_id = g.id
    ),
    EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.group_id = g.id
        AND gm.user_id = auth.uid()
    ),
    g.is_discoverable
  FROM public.groups g
  WHERE upper(g.share_code) = upper(trim(p_code))
  LIMIT 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.preview_group_by_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.preview_group_by_code(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.preview_group_by_code(text) TO authenticated;
