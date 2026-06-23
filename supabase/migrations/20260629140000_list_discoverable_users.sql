-- Paginated member directory for discovery / empty following states

CREATE OR REPLACE FUNCTION public.list_discoverable_users(
    p_limit int DEFAULT 30,
    p_offset int DEFAULT 0
)
RETURNS TABLE (
    user_id uuid,
    username text,
    avatar_url text,
    created_at timestamptz,
    total_bets int,
    is_following boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    RETURN QUERY
    SELECT
        u.id AS user_id,
        u.username,
        u.avatar_url,
        u.created_at,
        COALESCE(us.total_bets, 0)::int AS total_bets,
        CASE
            WHEN v_user_id IS NULL THEN false
            ELSE EXISTS (
                SELECT 1
                FROM public.user_follows uf
                WHERE uf.follower_id = v_user_id
                  AND uf.following_id = u.id
            )
        END AS is_following
    FROM public.users u
    LEFT JOIN public.user_stats us ON us.user_id = u.id
    WHERE u.username IS NOT NULL
      AND u.username NOT LIKE 'deleted\_%'
      AND (v_user_id IS NULL OR u.id <> v_user_id)
    ORDER BY u.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.list_discoverable_users(int, int) TO authenticated, anon;
