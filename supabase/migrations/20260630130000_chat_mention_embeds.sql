-- @-mention embed cards for group chat and public market chat

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS referenced_group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referenced_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bet_id uuid REFERENCES public.bets(id) ON DELETE SET NULL;

ALTER TABLE public.market_chat_messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS referenced_group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referenced_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bet_id uuid REFERENCES public.bets(id) ON DELETE SET NULL;

ALTER TABLE public.market_chat_messages
  DROP CONSTRAINT IF EXISTS market_chat_messages_content_check;

ALTER TABLE public.market_chat_messages
  ADD CONSTRAINT market_chat_messages_content_check CHECK (char_length(content) <= 500);

CREATE INDEX IF NOT EXISTS idx_messages_referenced_group ON public.messages(referenced_group_id)
  WHERE referenced_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_referenced_user ON public.messages(referenced_user_id)
  WHERE referenced_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_bet ON public.messages(bet_id)
  WHERE bet_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.search_mention_users(
  p_query text DEFAULT '',
  p_group_id uuid DEFAULT NULL,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  user_id uuid,
  username text,
  avatar_url text,
  is_group_member boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_pattern text := '%' || lower(trim(coalesce(p_query, ''))) || '%';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (u.id)
    u.id AS user_id,
    u.username,
    u.avatar_url,
    (
      p_group_id IS NOT NULL
      AND public.is_group_member(p_group_id, u.id)
    ) AS is_group_member
  FROM public.users u
  WHERE u.username IS NOT NULL
    AND u.username NOT LIKE 'deleted\_%'
    AND u.id <> v_user_id
    AND (
      trim(coalesce(p_query, '')) = ''
      OR lower(u.username) LIKE v_pattern
    )
    AND (
      (p_group_id IS NOT NULL AND public.is_group_member(p_group_id, u.id))
      OR EXISTS (SELECT 1 FROM public.user_stats us WHERE us.user_id = u.id)
      OR EXISTS (
        SELECT 1 FROM public.user_follows uf
        WHERE uf.following_id = u.id OR uf.follower_id = u.id
      )
    )
  ORDER BY u.id, u.username
  LIMIT greatest(p_limit, 1);
END;
$function$;

CREATE OR REPLACE FUNCTION public.search_mention_groups(
  p_query text DEFAULT '',
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  group_id uuid,
  name text,
  avatar_url text,
  member_count bigint,
  is_discoverable boolean,
  is_member boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_pattern text := '%' || lower(trim(coalesce(p_query, ''))) || '%';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    g.id AS group_id,
    g.name,
    g.avatar_url,
    (SELECT count(*) FROM public.group_members gm WHERE gm.group_id = g.id) AS member_count,
    g.is_discoverable,
    public.is_group_member(g.id, v_user_id) AS is_member
  FROM public.groups g
  WHERE coalesce(g.is_dm, false) = false
    AND (
      trim(coalesce(p_query, '')) = ''
      OR lower(coalesce(g.name, '')) LIKE v_pattern
    )
    AND (
      g.is_discoverable = true
      OR public.is_group_member(g.id, v_user_id)
    )
  ORDER BY
    public.is_group_member(g.id, v_user_id) DESC,
    g.name
  LIMIT greatest(p_limit, 1);
END;
$function$;

CREATE OR REPLACE FUNCTION public.search_mention_bets(
  p_query text DEFAULT '',
  p_group_id uuid DEFAULT NULL,
  p_market_id uuid DEFAULT NULL,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  bet_id uuid,
  user_id uuid,
  username text,
  avatar_url text,
  market_id uuid,
  market_question text,
  market_image_url text,
  amount numeric,
  side text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_pattern text := '%' || lower(trim(coalesce(p_query, ''))) || '%';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_group_id IS NULL AND p_market_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    b.id AS bet_id,
    b.user_id,
    u.username,
    u.avatar_url,
    m.id AS market_id,
    m.question AS market_question,
    m.image_url AS market_image_url,
    b.amount,
    coalesce(b.side, o.label) AS side
  FROM public.bets b
  JOIN public.markets m ON m.id = b.market_id
  JOIN public.users u ON u.id = b.user_id
  LEFT JOIN public.options o ON o.id = b.option_id AND o.market_id = b.market_id
  WHERE (
    (p_group_id IS NOT NULL AND m.group_id = p_group_id AND public.is_group_member(p_group_id, v_user_id))
    OR (p_market_id IS NOT NULL AND m.id = p_market_id AND m.is_public = true)
  )
  AND (
    trim(coalesce(p_query, '')) = ''
    OR lower(coalesce(u.username, '')) LIKE v_pattern
    OR lower(coalesce(m.question, '')) LIKE v_pattern
  )
  ORDER BY b.placed_at DESC
  LIMIT greatest(p_limit, 1);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_mention_card_group(p_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_group public.groups%ROWTYPE;
  v_member_count bigint;
  v_is_member boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_group FROM public.groups g WHERE g.id = p_group_id;
  IF NOT FOUND OR coalesce(v_group.is_dm, false) = true THEN
    RETURN NULL;
  END IF;

  v_is_member := public.is_group_member(p_group_id, v_user_id);
  IF v_group.is_discoverable IS NOT TRUE AND v_is_member IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_member_count FROM public.group_members gm WHERE gm.group_id = p_group_id;

  RETURN jsonb_build_object(
    'group_id', v_group.id,
    'name', v_group.name,
    'avatar_url', v_group.avatar_url,
    'member_count', v_member_count,
    'is_discoverable', v_group.is_discoverable,
    'is_member', v_is_member,
    'invite_code', CASE
      WHEN v_group.is_discoverable = true AND v_is_member = true THEN v_group.share_code
      ELSE NULL
    END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_mention_card_profile(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_user public.users%ROWTYPE;
  v_followers bigint;
  v_win_rate numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_user FROM public.users u WHERE u.id = p_user_id;
  IF NOT FOUND OR v_user.username IS NULL OR v_user.username LIKE 'deleted\_%' THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_followers FROM public.user_follows uf WHERE uf.following_id = p_user_id;
  SELECT coalesce(us.win_rate, 0) INTO v_win_rate FROM public.user_stats us WHERE us.user_id = p_user_id;

  RETURN jsonb_build_object(
    'user_id', v_user.id,
    'username', v_user.username,
    'avatar_url', v_user.avatar_url,
    'followers_count', v_followers,
    'win_rate', coalesce(v_win_rate, 0)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_mention_card_bet(p_bet_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_bet public.bets%ROWTYPE;
  v_market public.markets%ROWTYPE;
  v_user public.users%ROWTYPE;
  v_side text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_bet FROM public.bets b WHERE b.id = p_bet_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_market FROM public.markets m WHERE m.id = v_bet.market_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF NOT (
    v_market.is_public = true
    OR (v_market.group_id IS NOT NULL AND public.is_group_member(v_market.group_id, v_user_id))
  ) THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_user FROM public.users u WHERE u.id = v_bet.user_id;

  SELECT coalesce(v_bet.side, o.label) INTO v_side
  FROM public.options o
  WHERE o.id = v_bet.option_id AND o.market_id = v_bet.market_id;

  RETURN jsonb_build_object(
    'bet_id', v_bet.id,
    'user_id', v_bet.user_id,
    'username', v_user.username,
    'avatar_url', v_user.avatar_url,
    'market_id', v_market.id,
    'market_question', v_market.question,
    'market_image_url', v_market.image_url,
    'amount', v_bet.amount,
    'side', v_side
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.search_mention_users(text, uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_mention_groups(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_mention_bets(text, uuid, uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mention_card_group(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mention_card_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mention_card_bet(uuid) TO authenticated;
