-- Migration: Add market_likes and market_shares tables for viral sharing feature
-- Created: 2026-01-27

-- ============================================================================
-- Table: market_likes
-- Tracks user likes on markets (public like count)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.market_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Each user can only like a market once
    CONSTRAINT market_likes_unique UNIQUE (user_id, market_id)
);

-- Index for fast like count queries
CREATE INDEX IF NOT EXISTS idx_market_likes_market ON public.market_likes(market_id);

-- Index for user's liked markets
CREATE INDEX IF NOT EXISTS idx_market_likes_user ON public.market_likes(user_id);

-- Enable RLS
ALTER TABLE public.market_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for market_likes
-- Anyone can view like counts (for public display)
CREATE POLICY "Anyone can view likes"
    ON public.market_likes
    FOR SELECT
    USING (true);

-- Users can insert their own likes
CREATE POLICY "Users can like markets"
    ON public.market_likes
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can remove their own likes
CREATE POLICY "Users can unlike markets"
    ON public.market_likes
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- Table: market_shares
-- Tracks share events for analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.market_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Can be null for anonymous shares
    market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
    share_code TEXT NOT NULL UNIQUE, -- Short unique code for tracking
    platform TEXT, -- 'ios', 'android', 'web', 'copy', etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for market share counts
CREATE INDEX IF NOT EXISTS idx_market_shares_market ON public.market_shares(market_id);

-- Index for looking up by share code
CREATE INDEX IF NOT EXISTS idx_market_shares_code ON public.market_shares(share_code);

-- Enable RLS
ALTER TABLE public.market_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies for market_shares
-- Anyone can view shares (for analytics)
CREATE POLICY "Anyone can view shares"
    ON public.market_shares
    FOR SELECT
    USING (true);

-- Anyone can create shares (including anonymous users)
CREATE POLICY "Anyone can create shares"
    ON public.market_shares
    FOR INSERT
    WITH CHECK (true);

-- ============================================================================
-- Function: get_market_social_stats
-- Returns like count and share count for a market
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_market_social_stats(p_market_id UUID)
RETURNS TABLE (
    like_count BIGINT,
    share_count BIGINT,
    comment_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM public.market_likes WHERE market_id = p_market_id) AS like_count,
        (SELECT COUNT(*) FROM public.market_shares WHERE market_id = p_market_id) AS share_count,
        (SELECT COUNT(*) FROM public.market_chat_messages WHERE market_id = p_market_id) AS comment_count;
END;
$$;

-- ============================================================================
-- Function: toggle_market_like
-- Toggles like status and returns new state
-- ============================================================================

CREATE OR REPLACE FUNCTION public.toggle_market_like(p_market_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_exists BOOLEAN;
    v_new_count BIGINT;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    -- Check if like exists
    SELECT EXISTS(
        SELECT 1 FROM public.market_likes 
        WHERE user_id = v_user_id AND market_id = p_market_id
    ) INTO v_exists;
    
    IF v_exists THEN
        -- Unlike
        DELETE FROM public.market_likes 
        WHERE user_id = v_user_id AND market_id = p_market_id;
    ELSE
        -- Like
        INSERT INTO public.market_likes (user_id, market_id)
        VALUES (v_user_id, p_market_id);
    END IF;
    
    -- Get new count
    SELECT COUNT(*) INTO v_new_count
    FROM public.market_likes WHERE market_id = p_market_id;
    
    RETURN jsonb_build_object(
        'liked', NOT v_exists,
        'count', v_new_count
    );
END;
$$;

-- ============================================================================
-- Function: generate_share_code
-- Generates a short unique share code
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_share_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_code TEXT;
    v_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate 8-character alphanumeric code
        v_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
        
        -- Check if it exists
        SELECT EXISTS(
            SELECT 1 FROM public.market_shares WHERE share_code = v_code
        ) INTO v_exists;
        
        EXIT WHEN NOT v_exists;
    END LOOP;
    
    RETURN v_code;
END;
$$;

-- ============================================================================
-- Function: track_market_share
-- Records a share event and returns the share code
-- ============================================================================

CREATE OR REPLACE FUNCTION public.track_market_share(
    p_market_id UUID,
    p_platform TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_share_code TEXT;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid(); -- Can be NULL for anonymous
    v_share_code := public.generate_share_code();
    
    INSERT INTO public.market_shares (user_id, market_id, share_code, platform)
    VALUES (v_user_id, p_market_id, v_share_code, p_platform);
    
    RETURN v_share_code;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_market_social_stats(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.toggle_market_like(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_market_share(UUID, TEXT) TO authenticated, anon;
