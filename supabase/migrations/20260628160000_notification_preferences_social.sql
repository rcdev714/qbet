-- Migration: Notification preferences, delivery tracking, social enhancements
-- Unified notification orchestration for email, in-app, and web push

-- ============================================================================
-- Schema extensions
-- ============================================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio text;

ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS is_dm boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.dm_pairs (
    user_a_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user_b_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_a_id, user_b_id),
    CONSTRAINT dm_pairs_ordered CHECK (user_a_id < user_b_id)
);

CREATE INDEX IF NOT EXISTS idx_dm_pairs_group ON public.dm_pairs(group_id);

ALTER TABLE public.dm_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own dm pairs"
    ON public.dm_pairs FOR SELECT
    USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- ============================================================================
-- user_notification_preferences
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
    user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    email_enabled boolean NOT NULL DEFAULT true,
    push_web_enabled boolean NOT NULL DEFAULT true,
    in_app_enabled boolean NOT NULL DEFAULT true,
    email_market_results boolean NOT NULL DEFAULT true,
    email_social boolean NOT NULL DEFAULT true,
    email_group_invites boolean NOT NULL DEFAULT true,
    push_market_results boolean NOT NULL DEFAULT true,
    push_social boolean NOT NULL DEFAULT true,
    in_app_market_results boolean NOT NULL DEFAULT true,
    in_app_social boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification preferences"
    ON public.user_notification_preferences FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
    ON public.user_notification_preferences FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
    ON public.user_notification_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- notification_deliveries
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
    channel text NOT NULL CHECK (channel IN ('email', 'web_push')),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped', 'failed')),
    provider_id text,
    idempotency_key text,
    error text,
    sent_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (notification_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_pending
    ON public.notification_deliveries(status, created_at)
    WHERE status = 'pending';

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification deliveries"
    ON public.notification_deliveries FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.notifications n
            WHERE n.id = notification_id AND n.user_id = auth.uid()
        )
    );

-- ============================================================================
-- web_push_subscriptions (web only)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_user ON public.web_push_subscriptions(user_id);

ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own web push subscriptions"
    ON public.web_push_subscriptions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- group_email_invites
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.group_email_invites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    email text NOT NULL,
    invited_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    invite_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
    accepted_at timestamptz,
    email_sent_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (group_id, email)
);

ALTER TABLE public.group_email_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group admins can view group email invites"
    ON public.group_email_invites FOR SELECT
    USING (public.is_group_admin(group_id, auth.uid()));

CREATE POLICY "Group admins can create group email invites"
    ON public.group_email_invites FOR INSERT
    WITH CHECK (public.is_group_admin(group_id, auth.uid()) AND auth.uid() = invited_by);

-- ============================================================================
-- notification_dispatch_queue
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notification_dispatch_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE UNIQUE,
    processed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_dispatch_queue_unprocessed
    ON public.notification_dispatch_queue(created_at)
    WHERE processed_at IS NULL;

-- ============================================================================
-- Initialize preferences on user creation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.initialize_notification_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
    INSERT INTO public.user_notification_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_initialize_notification_preferences ON public.users;
CREATE TRIGGER trg_initialize_notification_preferences
    AFTER INSERT ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.initialize_notification_preferences();

INSERT INTO public.user_notification_preferences (user_id)
SELECT id FROM public.users
ON CONFLICT (user_id) DO NOTHING;

-- Extend handle_new_auth_user (preferences created by trigger above on users insert)

-- ============================================================================
-- notify_user — central notification orchestrator
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
    v_skip_in_app boolean := false;
BEGIN
    SELECT * INTO v_prefs
    FROM public.user_notification_preferences
    WHERE user_id = p_user_id;

    IF v_prefs IS NOT NULL THEN
        IF NOT v_prefs.in_app_enabled THEN
            v_skip_in_app := true;
        ELSIF p_type IN ('bet_won', 'bet_lost', 'market_resolved') AND NOT v_prefs.in_app_market_results THEN
            v_skip_in_app := true;
        ELSIF p_type IN ('new_follower', 'group_invite', 'group_invite_accepted') AND NOT v_prefs.in_app_social THEN
            v_skip_in_app := true;
        END IF;
    END IF;

    IF v_skip_in_app THEN
        RETURN NULL;
    END IF;

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (p_user_id, p_type, p_title, p_body, p_data)
    RETURNING * INTO v_notification;

    INSERT INTO public.notification_dispatch_queue (notification_id)
    VALUES (v_notification.id)
    ON CONFLICT (notification_id) DO NOTHING;

    RETURN v_notification;
END;
$function$;

-- ============================================================================
-- Enqueue dispatch on notification insert (for legacy create_notification calls)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enqueue_notification_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
    INSERT INTO public.notification_dispatch_queue (notification_id)
    VALUES (NEW.id)
    ON CONFLICT (notification_id) DO NOTHING;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enqueue_notification_dispatch ON public.notifications;
CREATE TRIGGER trg_enqueue_notification_dispatch
    AFTER INSERT ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.enqueue_notification_dispatch();

-- ============================================================================
-- Update market resolution notifications to use notify_user
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_market_resolution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    v_bet RECORD;
    v_winning_label TEXT;
    v_won BOOLEAN;
    v_title TEXT;
    v_type TEXT;
BEGIN
    IF NEW.status = 'resolved' AND (OLD.status IS NULL OR OLD.status <> 'resolved') THEN
        SELECT label INTO v_winning_label
        FROM public.options
        WHERE id = NEW.winning_option_id;

        FOR v_bet IN
            SELECT DISTINCT b.user_id, b.option_id, b.side
            FROM public.bets b
            WHERE b.market_id = NEW.id
        LOOP
            v_won := (v_bet.option_id = NEW.winning_option_id AND v_bet.side = 'yes')
                  OR (v_bet.option_id <> NEW.winning_option_id AND v_bet.side = 'no');

            IF v_won THEN
                v_title := '🎉 You won! "' || LEFT(NEW.question, 50) || '"';
                v_type := 'bet_won';
            ELSE
                v_title := '📊 Market resolved: "' || LEFT(NEW.question, 50) || '"';
                v_type := 'bet_lost';
            END IF;

            PERFORM public.notify_user(
                v_bet.user_id,
                v_type,
                v_title,
                'Winner: ' || v_winning_label,
                jsonb_build_object(
                    'market_id', NEW.id,
                    'market_question', NEW.question,
                    'winning_option_id', NEW.winning_option_id,
                    'won', v_won,
                    'is_public', COALESCE(NEW.is_public, false)
                )
            );
        END LOOP;

        -- Notify market creator if not already a bettor
        IF NEW.creator_id IS NOT NULL THEN
            PERFORM public.notify_user(
                NEW.creator_id,
                'market_resolved',
                '📊 Your market resolved: "' || LEFT(NEW.question, 50) || '"',
                'Winner: ' || v_winning_label,
                jsonb_build_object(
                    'market_id', NEW.id,
                    'market_question', NEW.question,
                    'winning_option_id', NEW.winning_option_id,
                    'is_public', COALESCE(NEW.is_public, false)
                )
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

-- ============================================================================
-- New follower notification
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_on_new_follower()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    v_follower_username text;
BEGIN
    SELECT username INTO v_follower_username
    FROM public.users
    WHERE id = NEW.follower_id;

    PERFORM public.notify_user(
        NEW.following_id,
        'new_follower',
        '@' || COALESCE(v_follower_username, 'someone') || ' started following you',
        NULL,
        jsonb_build_object(
            'follower_id', NEW.follower_id,
            'follower_username', v_follower_username
        )
    );

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_on_new_follower ON public.user_follows;
CREATE TRIGGER trg_notify_on_new_follower
    AFTER INSERT ON public.user_follows
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_on_new_follower();

-- ============================================================================
-- get_following
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_following(p_user_id uuid)
RETURNS TABLE (
    id uuid,
    username text,
    avatar_url text,
    followed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
    SELECT
        u.id,
        u.username,
        u.avatar_url,
        uf.created_at AS followed_at
    FROM public.user_follows uf
    JOIN public.users u ON u.id = uf.following_id
    WHERE uf.follower_id = p_user_id
    ORDER BY uf.created_at DESC;
$function$;

-- ============================================================================
-- get_following_activity
-- ============================================================================

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

-- ============================================================================
-- get_suggested_users
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_suggested_users(p_limit int DEFAULT 10)
RETURNS TABLE (
    user_id uuid,
    username text,
    avatar_url text,
    total_profit numeric,
    win_rate numeric,
    total_bets int
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
        us.user_id,
        u.username,
        u.avatar_url,
        us.total_profit,
        us.win_rate,
        us.total_bets
    FROM public.user_stats us
    JOIN public.users u ON u.id = us.user_id
    WHERE us.total_bets >= 5
      AND (v_user_id IS NULL OR us.user_id <> v_user_id)
      AND (v_user_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM public.user_follows uf
          WHERE uf.follower_id = v_user_id AND uf.following_id = us.user_id
      ))
    ORDER BY us.total_profit DESC
    LIMIT p_limit;
END;
$function$;

-- ============================================================================
-- update_notification_preferences
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
        updated_at = now()
    WHERE user_id = v_user_id
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$function$;

-- ============================================================================
-- register_web_push_subscription
-- ============================================================================

CREATE OR REPLACE FUNCTION public.register_web_push_subscription(
    p_endpoint text,
    p_p256dh text,
    p_auth text,
    p_user_agent text DEFAULT NULL
)
RETURNS public.web_push_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_row public.web_push_subscriptions;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    INSERT INTO public.web_push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
    VALUES (v_user_id, p_endpoint, p_p256dh, p_auth, p_user_agent)
    ON CONFLICT (user_id, endpoint) DO UPDATE SET
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        user_agent = EXCLUDED.user_agent
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$function$;

-- ============================================================================
-- find_or_create_dm_group
-- ============================================================================

CREATE OR REPLACE FUNCTION public.find_or_create_dm_group(p_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_group_id uuid;
    v_a uuid;
    v_b uuid;
    v_other_username text;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF v_user_id = p_other_user_id THEN
        RAISE EXCEPTION 'Cannot DM yourself';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_other_user_id) THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    v_a := LEAST(v_user_id, p_other_user_id);
    v_b := GREATEST(v_user_id, p_other_user_id);

    SELECT dp.group_id INTO v_group_id
    FROM public.dm_pairs dp
    WHERE dp.user_a_id = v_a AND dp.user_b_id = v_b;

    IF v_group_id IS NOT NULL THEN
        RETURN v_group_id;
    END IF;

    SELECT username INTO v_other_username FROM public.users WHERE id = p_other_user_id;

    INSERT INTO public.groups (name, admin_id, is_dm, description)
    VALUES (
        COALESCE(v_other_username, 'Direct Message'),
        v_user_id,
        true,
        'Direct message'
    )
    RETURNING id INTO v_group_id;

    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES
        (v_group_id, v_user_id, 'admin'),
        (v_group_id, p_other_user_id, 'member');

    INSERT INTO public.dm_pairs (user_a_id, user_b_id, group_id)
    VALUES (v_a, v_b, v_group_id);

    RETURN v_group_id;
END;
$function$;

-- ============================================================================
-- mark_notification_dispatch_processed
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_notification_dispatch_processed(p_notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
    UPDATE public.notification_dispatch_queue
    SET processed_at = now()
    WHERE notification_id = p_notification_id;
END;
$function$;

-- ============================================================================
-- record_notification_delivery
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_notification_delivery(
    p_notification_id uuid,
    p_channel text,
    p_status text,
    p_provider_id text DEFAULT NULL,
    p_idempotency_key text DEFAULT NULL,
    p_error text DEFAULT NULL
)
RETURNS public.notification_deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    v_row public.notification_deliveries;
BEGIN
    INSERT INTO public.notification_deliveries (
        notification_id, channel, status, provider_id, idempotency_key, error, sent_at
    )
    VALUES (
        p_notification_id,
        p_channel,
        p_status,
        p_provider_id,
        p_idempotency_key,
        p_error,
        CASE WHEN p_status = 'sent' THEN now() ELSE NULL END
    )
    ON CONFLICT (notification_id, channel) DO UPDATE SET
        status = EXCLUDED.status,
        provider_id = COALESCE(EXCLUDED.provider_id, notification_deliveries.provider_id),
        error = EXCLUDED.error,
        sent_at = CASE WHEN EXCLUDED.status = 'sent' THEN now() ELSE notification_deliveries.sent_at END
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$function$;

-- ============================================================================
-- get_notification_preferences
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_notification_preferences()
RETURNS public.user_notification_preferences
LANGUAGE plpgsql
STABLE
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

    SELECT * INTO v_row
    FROM public.user_notification_preferences
    WHERE user_id = v_user_id;

    RETURN v_row;
END;
$function$;

-- Grants
GRANT EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_following(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_following_activity(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_suggested_users(int) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.update_notification_preferences(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_web_push_subscription(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_create_dm_group(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_notification_preferences() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_dispatch_processed(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_notification_delivery(uuid, text, text, text, text, text) TO service_role;
