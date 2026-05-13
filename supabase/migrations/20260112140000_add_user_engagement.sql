-- User engagement tracking for recommendation algorithm
CREATE TABLE user_engagement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    category TEXT,
    views INTEGER DEFAULT 1,
    view_duration_ms INTEGER DEFAULT 0,
    viewed_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, market_id)
);

-- Index for fast category-based queries per user
CREATE INDEX idx_user_engagement_user_category ON user_engagement(user_id, category);
CREATE INDEX idx_user_engagement_market ON user_engagement(market_id);

-- Comment on table
COMMENT ON TABLE user_engagement IS 'Tracks user viewing time and views per market for recommendation algorithm';
COMMENT ON COLUMN user_engagement.views IS 'Number of times user viewed this market';
COMMENT ON COLUMN user_engagement.view_duration_ms IS 'Total milliseconds spent viewing this market';
COMMENT ON COLUMN user_engagement.category IS 'Cached category from the market for faster queries';

-- RLS policies
ALTER TABLE user_engagement ENABLE ROW LEVEL SECURITY;

-- Users can only see/modify their own engagement data
CREATE POLICY "Users can view own engagement" ON user_engagement
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own engagement" ON user_engagement
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own engagement" ON user_engagement
    FOR UPDATE USING (auth.uid() = user_id);

-- Function to upsert engagement (increment views, add duration)
CREATE OR REPLACE FUNCTION upsert_engagement(
    p_user_id UUID,
    p_market_id UUID,
    p_category TEXT,
    p_duration_ms INTEGER
) RETURNS void AS $$
BEGIN
    INSERT INTO user_engagement (user_id, market_id, category, views, view_duration_ms)
    VALUES (p_user_id, p_market_id, p_category, 1, p_duration_ms)
    ON CONFLICT (user_id, market_id)
    DO UPDATE SET
        views = user_engagement.views + 1,
        view_duration_ms = user_engagement.view_duration_ms + EXCLUDED.view_duration_ms,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
