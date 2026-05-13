-- 1. Add the column
ALTER TABLE markets ADD COLUMN IF NOT EXISTS market_type text DEFAULT 'multi_option';

-- 2. Backfill existing "Yes/No" markets as 'binary'
-- Strictly identifies markets with exactly 2 options labeled "Yes" and "No" (case-insensitive)
UPDATE markets 
SET market_type = 'binary' 
WHERE id IN (
  SELECT market_id 
  FROM options 
  GROUP BY market_id 
  HAVING COUNT(*) = 2
) 
AND EXISTS (
  SELECT 1 FROM options o WHERE o.market_id = markets.id AND LOWER(TRIM(o.label)) = 'yes'
)
AND EXISTS (
  SELECT 1 FROM options o WHERE o.market_id = markets.id AND LOWER(TRIM(o.label)) = 'no'
);
