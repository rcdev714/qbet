CREATE OR REPLACE FUNCTION public.toggle_market_like(p_market_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_liked boolean;
  v_count int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if already liked
  IF EXISTS (SELECT 1 FROM public.market_likes WHERE market_id = p_market_id AND user_id = v_user_id) THEN
    DELETE FROM public.market_likes WHERE market_id = p_market_id AND user_id = v_user_id;
    v_liked := false;
  ELSE
    INSERT INTO public.market_likes (market_id, user_id) VALUES (p_market_id, v_user_id);
    v_liked := true;
  END IF;

  -- Get new count
  SELECT count(*) INTO v_count FROM public.market_likes WHERE market_id = p_market_id;

  RETURN jsonb_build_object('liked', v_liked, 'count', v_count);
END;
$$;;
