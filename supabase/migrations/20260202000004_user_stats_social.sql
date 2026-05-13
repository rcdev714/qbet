-- Migration: User Stats & Social
-- Created: 2026-02-02
-- Phase 4 of ontology improvements: Materialized user stats and social graph

-- ============================================================================
-- Table: user_stats
-- Materialized statistics for fast profile rendering and leaderboards
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_stats (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    total_bets INT DEFAULT 0,
    total_wins INT DEFAULT 0,
    total_losses INT DEFAULT 0,
    win_rate NUMERIC(5,4) DEFAULT 0,           -- 0.0000 to 1.0000
    total_wagered NUMERIC DEFAULT 0,
    total_profit NUMERIC DEFAULT 0,
    best_streak INT DEFAULT 0,
    current_streak INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_user_stats_profit ON public.user_stats(total_profit DESC);
CREATE INDEX IF NOT EXISTS idx_user_stats_win_rate ON public.user_stats(win_rate DESC) WHERE total_bets >= 10;

-- Enable RLS
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- Anyone can view user stats (public leaderboards)
CREATE POLICY "Anyone can view user stats"
    ON public.user_stats
    FOR SELECT
    USING (true);

-- ============================================================================
-- Table: user_follows
-- Social graph for following other users
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_follows (
    follower_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, following_id),
    CONSTRAINT no_self_follow CHECK (follower_id <> following_id)
);

-- Index for "who do I follow"
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON public.user_follows(follower_id);

-- Index for "who follows me"
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON public.user_follows(following_id);

-- Enable RLS
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- Anyone can view follows (public social graph)
CREATE POLICY "Anyone can view follows"
    ON public.user_follows
    FOR SELECT
    USING (true);

-- Users can follow others
CREATE POLICY "Users can create follows"
    ON public.user_follows
    FOR INSERT
    WITH CHECK (auth.uid() = follower_id);

-- Users can unfollow
CREATE POLICY "Users can delete own follows"
    ON public.user_follows
    FOR DELETE
    USING (auth.uid() = follower_id);

-- ============================================================================
-- Table: category_follows
-- Users subscribing to categories for feed personalization
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.category_follows (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, category_id)
);

-- Index for "what categories do I follow"
CREATE INDEX IF NOT EXISTS idx_category_follows_user ON public.category_follows(user_id);

-- Enable RLS
ALTER TABLE public.category_follows ENABLE ROW LEVEL SECURITY;

-- Anyone can view category follows
CREATE POLICY "Anyone can view category follows"
    ON public.category_follows
    FOR SELECT
    USING (true);

-- Users can follow categories
CREATE POLICY "Users can follow categories"
    ON public.category_follows
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can unfollow categories
CREATE POLICY "Users can unfollow categories"
    ON public.category_follows
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- Function: toggle_user_follow
-- ============================================================================

CREATE OR REPLACE FUNCTION public.toggle_user_follow(p_target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_exists BOOLEAN;
    v_follower_count BIGINT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF v_user_id = p_target_user_id THEN
        RAISE EXCEPTION 'Cannot follow yourself';
    END IF;

    -- Check if already following
    SELECT EXISTS(
        SELECT 1 FROM public.user_follows 
        WHERE follower_id = v_user_id AND following_id = p_target_user_id
    ) INTO v_exists;

    IF v_exists THEN
        -- Unfollow
        DELETE FROM public.user_follows 
        WHERE follower_id = v_user_id AND following_id = p_target_user_id;
    ELSE
        -- Follow
        INSERT INTO public.user_follows (follower_id, following_id)
        VALUES (v_user_id, p_target_user_id);
    END IF;

    -- Get new follower count
    SELECT COUNT(*) INTO v_follower_count
    FROM public.user_follows WHERE following_id = p_target_user_id;

    RETURN jsonb_build_object(
        'following', NOT v_exists,
        'follower_count', v_follower_count
    );
END;
$function$;

-- ============================================================================
-- Function: get_follow_counts
-- Get follower and following counts for a user
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_follow_counts(p_user_id UUID)
RETURNS TABLE (
    followers_count BIGINT,
    following_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
    SELECT 
        (SELECT COUNT(*) FROM public.user_follows WHERE following_id = p_user_id) AS followers_count,
        (SELECT COUNT(*) FROM public.user_follows WHERE follower_id = p_user_id) AS following_count;
$function$;

-- ============================================================================
-- Function: initialize_user_stats
-- Create stats row when user is created
-- ============================================================================

CREATE OR REPLACE FUNCTION public.initialize_user_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
    INSERT INTO public.user_stats (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$function$;

-- Create trigger for new users
DROP TRIGGER IF EXISTS trg_initialize_user_stats ON public.users;
CREATE TRIGGER trg_initialize_user_stats
    AFTER INSERT ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.initialize_user_stats();

-- Initialize stats for existing users
INSERT INTO public.user_stats (user_id)
SELECT id FROM public.users
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- Function: update_user_stats_on_resolution
-- Update user stats when transaction created (bet_won/bet_lost)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_user_stats_on_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    v_is_win BOOLEAN;
    v_wager NUMERIC;
    v_profit NUMERIC;
BEGIN
    -- Only process completed bet_won or bet_lost transactions
    IF NEW.status <> 'completed' THEN
        RETURN NEW;
    END IF;

    IF NEW.type = 'bet_won' THEN
        v_is_win := true;
        v_wager := COALESCE((NEW.metadata->>'wager')::NUMERIC, 0);
        v_profit := NEW.amount - v_wager;  -- Profit = payout - original wager
    ELSIF NEW.type = 'bet_lost' THEN
        v_is_win := false;
        v_wager := COALESCE((NEW.metadata->>'wager')::NUMERIC, 0);
        v_profit := -v_wager;  -- Loss = negative wager
    ELSE
        RETURN NEW;  -- Not a resolution transaction
    END IF;

    -- Update stats
    UPDATE public.user_stats
    SET 
        total_bets = total_bets + 1,
        total_wins = total_wins + CASE WHEN v_is_win THEN 1 ELSE 0 END,
        total_losses = total_losses + CASE WHEN v_is_win THEN 0 ELSE 1 END,
        total_wagered = total_wagered + v_wager,
        total_profit = total_profit + v_profit,
        current_streak = CASE 
            WHEN v_is_win THEN 
                CASE WHEN current_streak >= 0 THEN current_streak + 1 ELSE 1 END
            ELSE 
                CASE WHEN current_streak <= 0 THEN current_streak - 1 ELSE -1 END
        END,
        best_streak = GREATEST(
            best_streak, 
            CASE WHEN v_is_win THEN 
                CASE WHEN current_streak >= 0 THEN current_streak + 1 ELSE 1 END
            ELSE current_streak END
        ),
        win_rate = CASE 
            WHEN (total_bets + 1) > 0 
            THEN (total_wins + CASE WHEN v_is_win THEN 1 ELSE 0 END)::NUMERIC / (total_bets + 1)
            ELSE 0 
        END,
        updated_at = now()
    WHERE user_id = NEW.user_id;

    RETURN NEW;
END;
$function$;

-- Create trigger for transactions
DROP TRIGGER IF EXISTS trg_update_user_stats ON public.transactions;
CREATE TRIGGER trg_update_user_stats
    AFTER INSERT ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_user_stats_on_transaction();

-- ============================================================================
-- Function: get_leaderboard
-- Get top users by profit or win rate
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_leaderboard(
    p_metric TEXT DEFAULT 'profit',  -- 'profit' or 'win_rate'
    p_limit INT DEFAULT 10
)
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    avatar_url TEXT,
    total_profit NUMERIC,
    win_rate NUMERIC,
    total_bets INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
    SELECT 
        us.user_id,
        u.username,
        u.avatar_url,
        us.total_profit,
        us.win_rate,
        us.total_bets
    FROM public.user_stats us
    JOIN public.users u ON us.user_id = u.id
    WHERE us.total_bets >= 5  -- Minimum bets to qualify
    ORDER BY 
        CASE WHEN p_metric = 'profit' THEN us.total_profit ELSE NULL END DESC NULLS LAST,
        CASE WHEN p_metric = 'win_rate' THEN us.win_rate ELSE NULL END DESC NULLS LAST
    LIMIT p_limit;
$function$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.toggle_user_follow(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_follow_counts(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(TEXT, INT) TO authenticated, anon;
