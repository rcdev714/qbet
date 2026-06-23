-- Engagement social graph: activity privacy, market social proof, admin analytics

-- ============================================================================
-- get_following_activity_v2 — extended with privacy, stats, membership
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
  market_status text,
  market_yes_pct numeric,
  side text,
  bet_amount numeric,
  profit_loss numeric,
  group_id uuid,
  group_name text,
  is_member boolean,
  comment_preview text,
  outcome text,
  actor_total_bets int,
  actor_win_rate numeric,
  actor_current_streak int,
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
      CASE
        WHEN m.group_id IS NOT NULL
          AND coalesce(m.is_public, false) = false
          AND NOT EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = m.group_id AND gm.user_id = v_user_id
          )
        THEN 'Private group market'
        ELSE m.question
      END AS market_question,
      m.status::text AS market_status,
      (
        SELECT round(coalesce(o.yes_price, 0.5) * 100, 1)
        FROM public.options o
        WHERE o.market_id = m.id AND o.label ILIKE 'yes'
        LIMIT 1
      ) AS market_yes_pct,
      b.side,
      CASE
        WHEN m.group_id IS NOT NULL
          AND coalesce(m.is_public, false) = false
          AND NOT EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = m.group_id AND gm.user_id = v_user_id
          )
        THEN NULL::numeric
        ELSE b.amount
      END AS bet_amount,
      NULL::numeric AS profit_loss,
      CASE
        WHEN m.group_id IS NOT NULL
          AND (
            coalesce(m.is_public, false) = true
            OR EXISTS (
              SELECT 1 FROM public.group_members gm
              WHERE gm.group_id = m.group_id AND gm.user_id = v_user_id
            )
            OR EXISTS (
              SELECT 1 FROM public.groups g
              WHERE g.id = m.group_id AND g.is_discoverable = true
            )
          )
        THEN m.group_id
        ELSE NULL::uuid
      END AS group_id,
      CASE
        WHEN m.group_id IS NOT NULL
          AND (
            coalesce(m.is_public, false) = true
            OR EXISTS (
              SELECT 1 FROM public.group_members gm
              WHERE gm.group_id = m.group_id AND gm.user_id = v_user_id
            )
            OR EXISTS (
              SELECT 1 FROM public.groups g
              WHERE g.id = m.group_id AND g.is_discoverable = true
            )
          )
        THEN (SELECT g.name FROM public.groups g WHERE g.id = m.group_id)
        ELSE NULL::text
      END AS group_name,
      false AS is_member,
      NULL::text AS comment_preview,
      NULL::text AS outcome,
      coalesce(us.total_bets, 0) AS actor_total_bets,
      coalesce(us.win_rate, 0) AS actor_win_rate,
      coalesce(us.current_streak, 0) AS actor_current_streak,
      b.placed_at AS created_at
    FROM public.bets b
    JOIN public.users u ON u.id = b.user_id
    JOIN public.markets m ON m.id = b.market_id
    LEFT JOIN public.user_stats us ON us.user_id = u.id
    WHERE b.user_id IN (SELECT following_id FROM followed)
      AND b.placed_at >= now() - interval '30 days'
      AND (
        m.group_id IS NULL
        OR coalesce(m.is_public, false) = true
        OR EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = m.group_id AND gm.user_id = v_user_id
        )
      )

    UNION ALL

    -- bet won / lost
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
      m.status::text AS market_status,
      NULL::numeric AS market_yes_pct,
      b.side,
      b.amount AS bet_amount,
      CASE
        WHEN (
          b.option_id = m.winning_option_id
          OR (b.side = 'yes' AND o.label ILIKE 'yes')
          OR (b.side = 'no' AND o.label ILIKE 'no')
        ) THEN b.amount
        ELSE -b.amount
      END AS profit_loss,
      m.group_id,
      (SELECT g.name FROM public.groups g WHERE g.id = m.group_id) AS group_name,
      false AS is_member,
      NULL::text,
      CASE
        WHEN (
          b.option_id = m.winning_option_id
          OR (b.side = 'yes' AND o.label ILIKE 'yes')
          OR (b.side = 'no' AND o.label ILIKE 'no')
        ) THEN 'won'
        ELSE 'lost'
      END AS outcome,
      coalesce(us.total_bets, 0),
      coalesce(us.win_rate, 0),
      coalesce(us.current_streak, 0),
      coalesce(m.resolved_at, m.updated_at, b.placed_at) AS created_at
    FROM public.bets b
    JOIN public.users u ON u.id = b.user_id
    JOIN public.markets m ON m.id = b.market_id
    LEFT JOIN public.options o ON o.id = b.option_id
    LEFT JOIN public.user_stats us ON us.user_id = u.id
    WHERE b.user_id IN (SELECT following_id FROM followed)
      AND m.status = 'resolved'
      AND coalesce(m.resolved_at, m.updated_at) >= now() - interval '30 days'
      AND (
        m.group_id IS NULL
        OR coalesce(m.is_public, false) = true
        OR EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = m.group_id AND gm.user_id = v_user_id
        )
      )

    UNION ALL

    -- market comments on public markets
    SELECT
      msg.id,
      u.id,
      u.username,
      u.avatar_url,
      'market_comment'::text,
      m.id,
      m.question,
      m.status::text,
      NULL::numeric,
      NULL::text,
      NULL::numeric,
      NULL::numeric,
      NULL::uuid,
      NULL::text,
      false,
      left(msg.content, 120),
      NULL::text,
      coalesce(us.total_bets, 0),
      coalesce(us.win_rate, 0),
      coalesce(us.current_streak, 0),
      msg.created_at
    FROM public.market_chat_messages msg
    JOIN public.users u ON u.id = msg.user_id
    JOIN public.markets m ON m.id = msg.market_id
    LEFT JOIN public.user_stats us ON us.user_id = u.id
    WHERE msg.user_id IN (SELECT following_id FROM followed)
      AND coalesce(m.is_public, false) = true
      AND msg.created_at >= now() - interval '30 days'

    UNION ALL

    -- group created
    SELECT
      g.id,
      u.id,
      u.username,
      u.avatar_url,
      'group_created'::text,
      NULL::uuid,
      NULL::text,
      NULL::text,
      NULL::numeric,
      NULL::text,
      NULL::numeric,
      NULL::numeric,
      g.id,
      g.name,
      EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = g.id AND gm.user_id = v_user_id
      ),
      NULL::text,
      NULL::text,
      coalesce(us.total_bets, 0),
      coalesce(us.win_rate, 0),
      coalesce(us.current_streak, 0),
      g.created_at
    FROM public.groups g
    JOIN public.users u ON u.id = g.admin_id
    LEFT JOIN public.user_stats us ON us.user_id = u.id
    WHERE g.admin_id IN (SELECT following_id FROM followed)
      AND coalesce(g.is_dm, false) = false
      AND g.created_at >= now() - interval '30 days'

    UNION ALL

    -- group joined
    SELECT
      gm.group_id,
      u.id,
      u.username,
      u.avatar_url,
      'group_joined'::text,
      NULL::uuid,
      NULL::text,
      NULL::text,
      NULL::numeric,
      NULL::text,
      NULL::numeric,
      NULL::numeric,
      g.id,
      g.name,
      EXISTS (
        SELECT 1 FROM public.group_members gm2
        WHERE gm2.group_id = g.id AND gm2.user_id = v_user_id
      ),
      NULL::text,
      NULL::text,
      coalesce(us.total_bets, 0),
      coalesce(us.win_rate, 0),
      coalesce(us.current_streak, 0),
      gm.joined_at
    FROM public.group_members gm
    JOIN public.users u ON u.id = gm.user_id
    JOIN public.groups g ON g.id = gm.group_id
    LEFT JOIN public.user_stats us ON us.user_id = u.id
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

-- ============================================================================
-- get_market_social_proof — followed users who bet on a market
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_market_social_proof(p_market_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('followed_bettors', '[]'::jsonb, 'total_followed', 0);
  END IF;

  SELECT jsonb_build_object(
    'followed_bettors',
      coalesce(
        (
          SELECT jsonb_agg(row_to_json(t))
          FROM (
            SELECT
              u.id AS user_id,
              u.username,
              u.avatar_url,
              b.side,
              b.amount
            FROM public.bets b
            JOIN public.users u ON u.id = b.user_id
            WHERE b.market_id = p_market_id
              AND b.user_id IN (
                SELECT following_id FROM public.user_follows WHERE follower_id = v_user_id
              )
            ORDER BY b.placed_at DESC
            LIMIT 5
          ) t
        ),
        '[]'::jsonb
      ),
    'total_followed',
      (
        SELECT count(DISTINCT b.user_id)
        FROM public.bets b
        WHERE b.market_id = p_market_id
          AND b.user_id IN (
            SELECT following_id FROM public.user_follows WHERE follower_id = v_user_id
          )
      )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- ============================================================================
-- Admin social graph RPCs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_social_kpis()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF public.is_app_admin(auth.uid()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  RETURN jsonb_build_object(
    'total_follows', (SELECT count(*) FROM public.user_follows),
    'follows_7d', (
      SELECT count(*) FROM public.user_follows
      WHERE created_at >= now() - interval '7 days'
    ),
    'users_with_followers', (
      SELECT count(DISTINCT following_id) FROM public.user_follows
    ),
    'avg_followers_per_user', (
      SELECT coalesce(avg(cnt), 0)
      FROM (
        SELECT count(*)::numeric AS cnt
        FROM public.user_follows
        GROUP BY following_id
      ) s
    ),
    'active_social_bettors_7d', (
      SELECT count(DISTINCT b.user_id)
      FROM public.bets b
      WHERE b.placed_at >= now() - interval '7 days'
        AND coalesce(b.is_play_mode, false) = false
        AND EXISTS (
          SELECT 1 FROM public.user_follows uf WHERE uf.follower_id = b.user_id OR uf.following_id = b.user_id
        )
    ),
    'active_groups', (
      SELECT count(*) FROM public.groups WHERE coalesce(is_dm, false) = false
    ),
    'group_joins_7d', (
      SELECT count(*) FROM public.group_members
      WHERE joined_at >= now() - interval '7 days'
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_follow_series(p_days int DEFAULT 14)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_start date := (current_date - greatest(p_days, 1));
  v_dates date[];
  v_counts int[];
  v_day date;
  v_i int := 0;
BEGIN
  IF public.is_app_admin(auth.uid()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  FOR v_day IN
    SELECT generate_series(v_start, current_date, interval '1 day')::date
  LOOP
    v_i := v_i + 1;
    v_dates[v_i] := v_day;
    v_counts[v_i] := (
      SELECT count(*)::int FROM public.user_follows
      WHERE created_at >= v_day
        AND created_at < v_day + interval '1 day'
    );
  END LOOP;

  RETURN jsonb_build_object('dates', to_jsonb(v_dates), 'counts', to_jsonb(v_counts));
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_admin_social_connectors(p_limit int DEFAULT 20)
RETURNS TABLE (
  user_id uuid,
  username text,
  followers_count bigint,
  following_count bigint,
  total_bets bigint,
  bet_volume numeric,
  win_rate numeric,
  group_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF public.is_app_admin(auth.uid()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.username,
    (SELECT count(*) FROM public.user_follows uf WHERE uf.following_id = u.id) AS followers_count,
    (SELECT count(*) FROM public.user_follows uf WHERE uf.follower_id = u.id) AS following_count,
    coalesce(us.total_bets, 0)::bigint AS total_bets,
    coalesce(us.total_wagered, 0) AS bet_volume,
    coalesce(us.win_rate, 0) AS win_rate,
    (
      SELECT count(*) FROM public.group_members gm WHERE gm.user_id = u.id
    ) AS group_count
  FROM public.users u
  LEFT JOIN public.user_stats us ON us.user_id = u.id
  WHERE EXISTS (
    SELECT 1 FROM public.user_follows uf WHERE uf.following_id = u.id OR uf.follower_id = u.id
  )
  ORDER BY
    (SELECT count(*) FROM public.user_follows uf WHERE uf.following_id = u.id) DESC,
    coalesce(us.total_wagered, 0) DESC
  LIMIT greatest(p_limit, 1);
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_admin_co_bet_clusters(p_limit int DEFAULT 20)
RETURNS TABLE (
  cluster_key text,
  cluster_type text,
  label text,
  user_count bigint,
  bet_count bigint,
  total_volume numeric,
  dominant_side text,
  last_activity timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF public.is_app_admin(auth.uid()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  RETURN QUERY
  WITH market_clusters AS (
    SELECT
      b.market_id::text AS cluster_key,
      'market'::text AS cluster_type,
      m.question AS label,
      count(DISTINCT b.user_id) AS user_count,
      count(*) AS bet_count,
      sum(b.amount) AS total_volume,
      mode() WITHIN GROUP (ORDER BY b.side) AS dominant_side,
      max(b.placed_at) AS last_activity
    FROM public.bets b
    JOIN public.markets m ON m.id = b.market_id
    WHERE b.placed_at >= now() - interval '7 days'
      AND coalesce(b.is_play_mode, false) = false
    GROUP BY b.market_id, m.question
    HAVING count(DISTINCT b.user_id) >= 3
  ),
  group_clusters AS (
    SELECT
      m.group_id::text AS cluster_key,
      'group'::text AS cluster_type,
      g.name AS label,
      count(DISTINCT b.user_id) AS user_count,
      count(*) AS bet_count,
      sum(b.amount) AS total_volume,
      mode() WITHIN GROUP (ORDER BY b.side) AS dominant_side,
      max(b.placed_at) AS last_activity
    FROM public.bets b
    JOIN public.markets m ON m.id = b.market_id
    JOIN public.groups g ON g.id = m.group_id
    WHERE b.placed_at >= now() - interval '7 days'
      AND coalesce(b.is_play_mode, false) = false
      AND m.group_id IS NOT NULL
    GROUP BY m.group_id, g.name
    HAVING count(DISTINCT b.user_id) >= 3
  )
  SELECT * FROM (
    SELECT * FROM market_clusters
    UNION ALL
    SELECT * FROM group_clusters
  ) combined
  ORDER BY total_volume DESC, last_activity DESC
  LIMIT greatest(p_limit, 1);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_market_social_proof(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_social_kpis() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_follow_series(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_admin_social_connectors(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_admin_co_bet_clusters(int) TO authenticated;

-- ============================================================================
-- list_discoverable_groups — discovery surface for public groups
-- ============================================================================

CREATE OR REPLACE FUNCTION public.list_discoverable_groups(
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
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
  v_user_id uuid := auth.uid();
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
      WHERE m.group_id = g.id AND m.status = 'open'
    ) AS active_market_count,
    (
      v_user_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = g.id AND gm.user_id = v_user_id
      )
    ) AS is_member
  FROM public.groups g
  WHERE coalesce(g.is_dm, false) = false
    AND g.is_discoverable = true
  ORDER BY g.created_at DESC
  LIMIT greatest(p_limit, 1)
  OFFSET greatest(p_offset, 0);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.list_discoverable_groups(int, int) TO authenticated, anon;
