-- Migration: Notifications System
-- Created: 2026-02-02
-- Phase 3 of ontology improvements: Unified notification system

-- ============================================================================
-- Table: notifications
-- Stores all user notifications across the platform
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,           -- 'bet_won', 'bet_lost', 'market_resolved', 'new_follower', 'dispute_resolved', etc.
    title TEXT NOT NULL,
    body TEXT,
    data JSONB,                   -- Additional context (market_id, amount, etc.)
    read_at TIMESTAMPTZ,          -- NULL = unread
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for user's unread notifications (most common query)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
    ON public.notifications(user_id, created_at DESC) 
    WHERE read_at IS NULL;

-- Index for user's all notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user 
    ON public.notifications(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
CREATE POLICY "Users can view own notifications"
    ON public.notifications
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications"
    ON public.notifications
    FOR UPDATE
    USING (auth.uid() = user_id);

-- ============================================================================
-- Function: get_notifications
-- Get user's notifications with optional unread filter
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_notifications(
    p_limit INT DEFAULT 50,
    p_unread_only BOOLEAN DEFAULT false
)
RETURNS SETOF public.notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_unread_only THEN
        RETURN QUERY
        SELECT * FROM public.notifications
        WHERE user_id = v_user_id AND read_at IS NULL
        ORDER BY created_at DESC
        LIMIT p_limit;
    ELSE
        RETURN QUERY
        SELECT * FROM public.notifications
        WHERE user_id = v_user_id
        ORDER BY created_at DESC
        LIMIT p_limit;
    END IF;
END;
$function$;

-- ============================================================================
-- Function: get_unread_count
-- Get count of unread notifications
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
    SELECT COUNT(*) 
    FROM public.notifications 
    WHERE user_id = auth.uid() AND read_at IS NULL;
$function$;

-- ============================================================================
-- Function: mark_notification_read
-- Mark a single notification as read
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS public.notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_notification public.notifications;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    UPDATE public.notifications
    SET read_at = now()
    WHERE id = p_notification_id AND user_id = v_user_id
    RETURNING * INTO v_notification;

    RETURN v_notification;
END;
$function$;

-- ============================================================================
-- Function: mark_all_notifications_read
-- Mark all user's notifications as read
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_count INT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    UPDATE public.notifications
    SET read_at = now()
    WHERE user_id = v_user_id AND read_at IS NULL;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$function$;

-- ============================================================================
-- Function: create_notification (internal helper)
-- Used by triggers to create notifications
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_body TEXT DEFAULT NULL,
    p_data JSONB DEFAULT NULL
)
RETURNS public.notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    v_notification public.notifications;
BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (p_user_id, p_type, p_title, p_body, p_data)
    RETURNING * INTO v_notification;

    RETURN v_notification;
END;
$function$;

-- ============================================================================
-- Trigger: notify_on_market_resolution
-- Create notifications for all bettors when a market resolves
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
BEGIN
    -- Only trigger on resolution (status changes to 'resolved')
    IF NEW.status = 'resolved' AND (OLD.status IS NULL OR OLD.status <> 'resolved') THEN
        -- Get winning option label
        SELECT label INTO v_winning_label 
        FROM public.options 
        WHERE id = NEW.winning_option_id;

        -- Notify all bettors on this market
        FOR v_bet IN
            SELECT DISTINCT b.user_id, b.option_id, b.side
            FROM public.bets b
            WHERE b.market_id = NEW.id
        LOOP
            DECLARE
                v_won BOOLEAN;
                v_title TEXT;
                v_type TEXT;
            BEGIN
                -- Determine if this user won
                v_won := (v_bet.option_id = NEW.winning_option_id AND v_bet.side = 'yes')
                      OR (v_bet.option_id <> NEW.winning_option_id AND v_bet.side = 'no');

                IF v_won THEN
                    v_title := '🎉 You won! "' || LEFT(NEW.question, 50) || '"';
                    v_type := 'bet_won';
                ELSE
                    v_title := '📊 Market resolved: "' || LEFT(NEW.question, 50) || '"';
                    v_type := 'bet_lost';
                END IF;

                -- Create notification
                INSERT INTO public.notifications (user_id, type, title, body, data)
                VALUES (
                    v_bet.user_id,
                    v_type,
                    v_title,
                    'Winner: ' || v_winning_label,
                    jsonb_build_object(
                        'market_id', NEW.id,
                        'winning_option_id', NEW.winning_option_id,
                        'won', v_won
                    )
                );
            END;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$function$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_notify_market_resolution ON public.markets;
CREATE TRIGGER trg_notify_market_resolution
    AFTER UPDATE ON public.markets
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_market_resolution();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_notifications(INT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
