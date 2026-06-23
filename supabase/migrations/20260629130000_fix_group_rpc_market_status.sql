-- Fix market status filter: enum has open/closed/resolved/cancelled (no 'active')

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
