-- Discoverable groups, profile group listings, expanded following activity

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS is_discoverable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_on_profile boolean NOT NULL DEFAULT true;

UPDATE public.groups
SET is_discoverable = false, show_on_profile = false
WHERE is_dm = true;

-- ============================================================================
-- get_groups_administered — settings group admin hub
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_groups_administered()
RETURNS TABLE (
  group_id uuid,
  name text,
  description text,
  avatar_url text,
  member_count bigint,
  active_market_count bigint,
  is_discoverable boolean,
  show_on_profile boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    g.id AS group_id,
    g.name,
    g.description,
    g.avatar_url,
    (SELECT count(*) FROM public.group_members gm WHERE gm.group_id = g.id) AS member_count,
    (
      SELECT count(*)
      FROM public.markets m
      WHERE m.group_id = g.id
        AND m.status = 'open'
    ) AS active_market_count,
    g.is_discoverable,
    g.show_on_profile,
    g.created_at
  FROM public.groups g
  WHERE g.admin_id = v_user_id
    AND coalesce(g.is_dm, false) = false
  ORDER BY g.created_at DESC;
END;
$function$;

-- ============================================================================
-- get_user_profile_groups — discoverable groups on a user's profile
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_profile_groups(p_user_id uuid)
RETURNS TABLE (
  group_id uuid,
  name text,
  description text,
  avatar_url text,
  member_count bigint,
  active_market_count bigint,
  is_member boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_viewer_id uuid := auth.uid();
BEGIN
  RETURN QUERY
  SELECT
    g.id AS group_id,
    g.name,
    g.description,
    g.avatar_url,
    (SELECT count(*) FROM public.group_members gm WHERE gm.group_id = g.id) AS member_count,
    (
      SELECT count(*)
      FROM public.markets m
      WHERE m.group_id = g.id
        AND m.status = 'open'
    ) AS active_market_count,
    (
      v_viewer_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = g.id AND gm.user_id = v_viewer_id
      )
    ) AS is_member
  FROM public.groups g
  WHERE g.admin_id = p_user_id
    AND coalesce(g.is_dm, false) = false
    AND g.show_on_profile = true
    AND g.is_discoverable = true
  ORDER BY g.created_at DESC;
END;
$function$;

-- ============================================================================
-- join_group_from_profile — one-tap join for discoverable groups
-- ============================================================================

CREATE OR REPLACE FUNCTION public.join_group_from_profile(p_group_id uuid)
RETURNS public.group_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_code text;
  v_membership public.group_members;
BEGIN
  SELECT g.share_code INTO v_code
  FROM public.groups g
  WHERE g.id = p_group_id
    AND coalesce(g.is_dm, false) = false
    AND g.is_discoverable = true;

  IF v_code IS NULL THEN
    RAISE EXCEPTION 'Group not joinable';
  END IF;

  SELECT * INTO v_membership FROM public.join_group_by_code(v_code);
  RETURN v_membership;
END;
$function$;

-- ============================================================================
-- update_group_visibility — admin toggles discoverability / profile display
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_group_visibility(
  p_group_id uuid,
  p_is_discoverable boolean DEFAULT NULL,
  p_show_on_profile boolean DEFAULT NULL
)
RETURNS public.groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_group public.groups;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_group FROM public.groups WHERE id = p_group_id;

  IF v_group.id IS NULL OR v_group.admin_id <> v_user_id OR coalesce(v_group.is_dm, false) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.groups
  SET
    is_discoverable = coalesce(p_is_discoverable, is_discoverable),
    show_on_profile = coalesce(p_show_on_profile, show_on_profile)
  WHERE id = p_group_id
  RETURNING * INTO v_group;

  RETURN v_group;
END;
$function$;

-- ============================================================================
-- get_following_activity_v2 — unified social timeline
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_following_activity_v2(
  p_limit int DEFAULT 30,
  p_offset int DEFAULT 0,
  p_types text[] DEFAULT NULL
)
RETURNS TABLE (
  activity_id uuid,
  user_id uuid,
  username text,
  avatar_url text,
  activity_type text,
  market_id uuid,
  market_question text,
  side text,
  group_id uuid,
  group_name text,
  comment_preview text,
  outcome text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  WITH followed AS (
    SELECT following_id FROM public.user_follows WHERE follower_id = v_user_id
  ),
  activities AS (
    -- bet placed
    SELECT
      b.id AS activity_id,
      u.id AS user_id,
      u.username,
      u.avatar_url,
      'bet_placed'::text AS activity_type,
      m.id AS market_id,
      m.question AS market_question,
      b.side,
      NULL::uuid AS group_id,
      NULL::text AS group_name,
      NULL::text AS comment_preview,
      NULL::text AS outcome,
      b.placed_at AS created_at
    FROM public.bets b
    JOIN public.users u ON u.id = b.user_id
    JOIN public.markets m ON m.id = b.market_id
    WHERE b.user_id IN (SELECT following_id FROM followed)
      AND b.placed_at >= now() - interval '30 days'

    UNION ALL

    -- bet won / lost (resolved markets)
    SELECT
      b.id AS activity_id,
      u.id AS user_id,
      u.username,
      u.avatar_url,
      CASE
        WHEN (
          b.option_id = m.winning_option_id
          OR (b.side = 'yes' AND o.label ILIKE 'yes')
          OR (b.side = 'no' AND o.label ILIKE 'no')
        ) THEN 'bet_won'
        ELSE 'bet_lost'
      END AS activity_type,
      m.id AS market_id,
      m.question AS market_question,
      b.side,
      NULL::uuid,
      NULL::text,
      NULL::text,
      CASE
        WHEN (
          b.option_id = m.winning_option_id
          OR (b.side = 'yes' AND o.label ILIKE 'yes')
          OR (b.side = 'no' AND o.label ILIKE 'no')
        ) THEN 'won'
        ELSE 'lost'
      END AS outcome,
      coalesce(m.resolved_at, m.updated_at, b.placed_at) AS created_at
    FROM public.bets b
    JOIN public.users u ON u.id = b.user_id
    JOIN public.markets m ON m.id = b.market_id
    LEFT JOIN public.options o ON o.id = b.option_id
    WHERE b.user_id IN (SELECT following_id FROM followed)
      AND m.status = 'resolved'
      AND coalesce(m.resolved_at, m.updated_at) >= now() - interval '30 days'

    UNION ALL

    -- market comments on public markets
    SELECT
      msg.id AS activity_id,
      u.id AS user_id,
      u.username,
      u.avatar_url,
      'market_comment'::text AS activity_type,
      m.id AS market_id,
      m.question AS market_question,
      NULL::text AS side,
      NULL::uuid,
      NULL::text,
      left(msg.content, 120) AS comment_preview,
      NULL::text AS outcome,
      msg.created_at
    FROM public.market_chat_messages msg
    JOIN public.users u ON u.id = msg.user_id
    JOIN public.markets m ON m.id = msg.market_id
    WHERE msg.user_id IN (SELECT following_id FROM followed)
      AND coalesce(m.is_public, false) = true
      AND msg.created_at >= now() - interval '30 days'

    UNION ALL

    -- group created
    SELECT
      g.id AS activity_id,
      u.id AS user_id,
      u.username,
      u.avatar_url,
      'group_created'::text AS activity_type,
      NULL::uuid AS market_id,
      NULL::text AS market_question,
      NULL::text AS side,
      g.id AS group_id,
      g.name AS group_name,
      NULL::text AS comment_preview,
      NULL::text AS outcome,
      g.created_at
    FROM public.groups g
    JOIN public.users u ON u.id = g.admin_id
    WHERE g.admin_id IN (SELECT following_id FROM followed)
      AND coalesce(g.is_dm, false) = false
      AND g.created_at >= now() - interval '30 days'

    UNION ALL

    -- group joined
    SELECT
      gm.group_id AS activity_id,
      u.id AS user_id,
      u.username,
      u.avatar_url,
      'group_joined'::text AS activity_type,
      NULL::uuid,
      NULL::text,
      NULL::text,
      g.id AS group_id,
      g.name AS group_name,
      NULL::text,
      NULL::text,
      gm.joined_at AS created_at
    FROM public.group_members gm
    JOIN public.users u ON u.id = gm.user_id
    JOIN public.groups g ON g.id = gm.group_id
    WHERE gm.user_id IN (SELECT following_id FROM followed)
      AND coalesce(g.is_dm, false) = false
      AND gm.joined_at >= now() - interval '30 days'
      AND gm.user_id <> g.admin_id
  )
  SELECT *
  FROM activities a
  WHERE p_types IS NULL OR a.activity_type = ANY(p_types)
  ORDER BY a.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_groups_administered() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_profile_groups(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.join_group_from_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_group_visibility(uuid, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_following_activity_v2(int, int, text[]) TO authenticated;
