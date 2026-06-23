-- bets uses placed_at, not created_at
CREATE OR REPLACE FUNCTION public.get_following_activity(p_limit int DEFAULT 30)
RETURNS TABLE (
    activity_id uuid,
    user_id uuid,
    username text,
    avatar_url text,
    activity_type text,
    market_id uuid,
    market_question text,
    side text,
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
        b.id AS activity_id,
        u.id AS user_id,
        u.username,
        u.avatar_url,
        'bet_placed'::text AS activity_type,
        m.id AS market_id,
        m.question AS market_question,
        b.side,
        b.placed_at AS created_at
    FROM public.bets b
    JOIN public.users u ON u.id = b.user_id
    JOIN public.markets m ON m.id = b.market_id
    WHERE b.user_id IN (
        SELECT following_id FROM public.user_follows WHERE follower_id = v_user_id
    )
    AND b.placed_at >= now() - interval '7 days'
    ORDER BY b.placed_at DESC
    LIMIT p_limit;
END;
$function$;
