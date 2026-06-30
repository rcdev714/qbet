-- Email smart controls: decoupled dispatch, digests, unsubscribe tokens

-- ============================================================================
-- Extend user_notification_preferences
-- ============================================================================

ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS email_frequency text NOT NULL DEFAULT 'immediate'
    CHECK (email_frequency IN ('immediate', 'daily_digest', 'weekly_digest')),
  ADD COLUMN IF NOT EXISTS email_skip_if_read boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_digest_hour_utc smallint NOT NULL DEFAULT 14
    CHECK (email_digest_hour_utc >= 0 AND email_digest_hour_utc <= 23);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

-- ============================================================================
-- Extend notification_dispatch_queue for channel-independent dispatch
-- ============================================================================

ALTER TABLE public.notification_dispatch_queue
  ALTER COLUMN notification_id DROP NOT NULL;

ALTER TABLE public.notification_dispatch_queue
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS event_title text,
  ADD COLUMN IF NOT EXISTS event_body text,
  ADD COLUMN IF NOT EXISTS event_data jsonb;

ALTER TABLE public.notification_dispatch_queue
  DROP CONSTRAINT IF EXISTS notification_dispatch_queue_notification_id_key;
DROP INDEX IF EXISTS notification_dispatch_queue_notification_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_dispatch_queue_notification_id
  ON public.notification_dispatch_queue(notification_id)
  WHERE notification_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_dispatch_queue_unprocessed_v2
  ON public.notification_dispatch_queue(created_at)
  WHERE processed_at IS NULL;

-- ============================================================================
-- Extend notification_deliveries audit columns
-- ============================================================================

ALTER TABLE public.notification_deliveries
  ADD COLUMN IF NOT EXISTS attachment_included boolean,
  ADD COLUMN IF NOT EXISTS digest_batch_id uuid;

-- ============================================================================
-- email_digest_queue
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_digest_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notification_id uuid REFERENCES public.notifications(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_title text NOT NULL,
  event_body text,
  event_data jsonb,
  digest_frequency text NOT NULL CHECK (digest_frequency IN ('daily_digest', 'weekly_digest')),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_digest_queue_pending
  ON public.email_digest_queue(user_id, digest_frequency, created_at)
  WHERE processed_at IS NULL;

ALTER TABLE public.email_digest_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own digest queue"
  ON public.email_digest_queue FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- email_unsubscribe_tokens
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('social', 'market_results', 'group_invites', 'all')),
  token_hash text NOT NULL UNIQUE,
  used_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_unsubscribe_tokens_user
  ON public.email_unsubscribe_tokens(user_id, category);

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Helper: should external channels dispatch for event type?
-- ============================================================================

CREATE OR REPLACE FUNCTION public.should_dispatch_external_notification(
  p_prefs public.user_notification_preferences,
  p_type text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $function$
BEGIN
  IF p_prefs IS NULL THEN
    RETURN true;
  END IF;

  IF p_type IN ('bet_won', 'bet_lost', 'market_resolved') THEN
    RETURN p_prefs.email_enabled AND p_prefs.email_market_results
        OR p_prefs.push_web_enabled AND p_prefs.push_market_results;
  END IF;

  IF p_type = 'new_follower' THEN
    RETURN p_prefs.email_enabled AND p_prefs.email_social
        OR p_prefs.push_web_enabled AND p_prefs.push_social;
  END IF;

  IF p_type IN ('group_invite', 'group_invite_accepted') THEN
    RETURN p_prefs.email_enabled AND p_prefs.email_group_invites
        OR p_prefs.push_web_enabled AND p_prefs.push_social;
  END IF;

  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.should_show_in_app_notification(
  p_prefs public.user_notification_preferences,
  p_type text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $function$
BEGIN
  IF p_prefs IS NULL THEN
    RETURN true;
  END IF;

  IF NOT p_prefs.in_app_enabled THEN
    RETURN false;
  END IF;

  IF p_type IN ('bet_won', 'bet_lost', 'market_resolved') THEN
    RETURN p_prefs.in_app_market_results;
  END IF;

  IF p_type IN ('new_follower', 'group_invite', 'group_invite_accepted') THEN
    RETURN p_prefs.in_app_social;
  END IF;

  RETURN true;
END;
$function$;

-- ============================================================================
-- notify_user — decoupled in-app vs email/push dispatch
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text DEFAULT NULL,
  p_data jsonb DEFAULT NULL
)
RETURNS public.notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_notification public.notifications;
  v_prefs public.user_notification_preferences;
  v_show_in_app boolean := true;
  v_should_dispatch boolean := false;
BEGIN
  SELECT * INTO v_prefs
  FROM public.user_notification_preferences
  WHERE user_id = p_user_id;

  v_show_in_app := public.should_show_in_app_notification(v_prefs, p_type);
  v_should_dispatch := public.should_dispatch_external_notification(v_prefs, p_type);

  IF v_show_in_app THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (p_user_id, p_type, p_title, p_body, p_data)
    RETURNING * INTO v_notification;

    INSERT INTO public.notification_dispatch_queue (
      notification_id, user_id, event_type, event_title, event_body, event_data
    )
    VALUES (
      v_notification.id, p_user_id, p_type, p_title, p_body, p_data
    )
    ON CONFLICT (notification_id) WHERE notification_id IS NOT NULL DO NOTHING;
  ELSIF v_should_dispatch THEN
    INSERT INTO public.notification_dispatch_queue (
      notification_id, user_id, event_type, event_title, event_body, event_data
    )
    VALUES (
      NULL, p_user_id, p_type, p_title, p_body, p_data
    );
  END IF;

  RETURN v_notification;
END;
$function$;

-- ============================================================================
-- enqueue_notification_dispatch trigger — include payload on queue row
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enqueue_notification_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.notification_dispatch_queue (
    notification_id, user_id, event_type, event_title, event_body, event_data
  )
  VALUES (
    NEW.id, NEW.user_id, NEW.type, NEW.title, NEW.body, NEW.data
  )
  ON CONFLICT (notification_id) WHERE notification_id IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- mark_notification_dispatch_processed — support queue id
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_notification_dispatch_processed(
  p_notification_id uuid DEFAULT NULL,
  p_queue_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF p_queue_id IS NOT NULL THEN
    UPDATE public.notification_dispatch_queue
    SET processed_at = now()
    WHERE id = p_queue_id;
    RETURN;
  END IF;

  IF p_notification_id IS NOT NULL THEN
    UPDATE public.notification_dispatch_queue
    SET processed_at = now()
    WHERE notification_id = p_notification_id;
  END IF;
END;
$function$;

-- ============================================================================
-- update_notification_preferences — smart columns
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_notification_preferences(p_prefs jsonb)
RETURNS public.user_notification_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.user_notification_preferences;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.user_notification_preferences (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.user_notification_preferences
  SET
    email_enabled = COALESCE((p_prefs->>'email_enabled')::boolean, email_enabled),
    push_web_enabled = COALESCE((p_prefs->>'push_web_enabled')::boolean, push_web_enabled),
    in_app_enabled = COALESCE((p_prefs->>'in_app_enabled')::boolean, in_app_enabled),
    email_market_results = COALESCE((p_prefs->>'email_market_results')::boolean, email_market_results),
    email_social = COALESCE((p_prefs->>'email_social')::boolean, email_social),
    email_group_invites = COALESCE((p_prefs->>'email_group_invites')::boolean, email_group_invites),
    push_market_results = COALESCE((p_prefs->>'push_market_results')::boolean, push_market_results),
    push_social = COALESCE((p_prefs->>'push_social')::boolean, push_social),
    in_app_market_results = COALESCE((p_prefs->>'in_app_market_results')::boolean, in_app_market_results),
    in_app_social = COALESCE((p_prefs->>'in_app_social')::boolean, in_app_social),
    email_frequency = COALESCE(NULLIF(p_prefs->>'email_frequency', ''), email_frequency),
    email_skip_if_read = COALESCE((p_prefs->>'email_skip_if_read')::boolean, email_skip_if_read),
    email_digest_hour_utc = COALESCE((p_prefs->>'email_digest_hour_utc')::smallint, email_digest_hour_utc),
    updated_at = now()
  WHERE user_id = v_user_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

-- ============================================================================
-- touch_user_last_active
-- ============================================================================

CREATE OR REPLACE FUNCTION public.touch_user_last_active()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.users
  SET last_active_at = now()
  WHERE id = auth.uid();
END;
$function$;

GRANT EXECUTE ON FUNCTION public.touch_user_last_active() TO authenticated;

-- ============================================================================
-- email unsubscribe token RPCs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.apply_email_unsubscribe(
  p_token_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_token public.email_unsubscribe_tokens;
BEGIN
  SELECT * INTO v_token
  FROM public.email_unsubscribe_tokens
  WHERE token_hash = p_token_hash
    AND used_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF v_token IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_expired');
  END IF;

  UPDATE public.email_unsubscribe_tokens
  SET used_at = now()
  WHERE id = v_token.id;

  IF v_token.category = 'all' THEN
    UPDATE public.user_notification_preferences
    SET email_enabled = false, updated_at = now()
    WHERE user_id = v_token.user_id;
  ELSIF v_token.category = 'social' THEN
    UPDATE public.user_notification_preferences
    SET email_social = false, updated_at = now()
    WHERE user_id = v_token.user_id;
  ELSIF v_token.category = 'market_results' THEN
    UPDATE public.user_notification_preferences
    SET email_market_results = false, updated_at = now()
    WHERE user_id = v_token.user_id;
  ELSIF v_token.category = 'group_invites' THEN
    UPDATE public.user_notification_preferences
    SET email_group_invites = false, updated_at = now()
    WHERE user_id = v_token.user_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'category', v_token.category);
END;
$function$;

CREATE OR REPLACE FUNCTION public.store_email_unsubscribe_token(
  p_user_id uuid,
  p_category text,
  p_token_hash text,
  p_expires_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.email_unsubscribe_tokens (user_id, category, token_hash, expires_at)
  VALUES (p_user_id, p_category, p_token_hash, p_expires_at)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.apply_email_unsubscribe(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.store_email_unsubscribe_token(uuid, text, text, timestamptz) TO service_role;

-- ============================================================================
-- enqueue_email_digest_item
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enqueue_email_digest_item(
  p_user_id uuid,
  p_notification_id uuid,
  p_event_type text,
  p_event_title text,
  p_event_body text,
  p_event_data jsonb,
  p_digest_frequency text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.email_digest_queue (
    user_id, notification_id, event_type, event_title, event_body, event_data, digest_frequency
  )
  VALUES (
    p_user_id, p_notification_id, p_event_type, p_event_title, p_event_body, p_event_data, p_digest_frequency
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.enqueue_email_digest_item(uuid, uuid, text, text, text, jsonb, text) TO service_role;
