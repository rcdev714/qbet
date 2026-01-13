-- Add public market fields
ALTER TABLE markets 
ADD COLUMN is_public BOOLEAN DEFAULT false,
ADD COLUMN category TEXT,
ADD COLUMN featured_at TIMESTAMPTZ;

-- Add index for public feed queries
CREATE INDEX idx_markets_public_featured ON markets(is_public, featured_at DESC);

-- Comment on columns
COMMENT ON COLUMN markets.is_public IS 'Whether this market appears in the public feed';
COMMENT ON COLUMN markets.featured_at IS 'Timestamp for when this market was featured/curated (used for sorting)';
COMMENT ON COLUMN markets.category IS 'Category tag for the market (e.g. Sports, Politics, Tech)';
