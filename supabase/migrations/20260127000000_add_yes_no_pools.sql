-- Add YES/NO pools for binary betting
ALTER TABLE public.options
  ADD COLUMN IF NOT EXISTS yes_pool numeric DEFAULT 0 CHECK (yes_pool >= 0),
  ADD COLUMN IF NOT EXISTS no_pool numeric DEFAULT 0 CHECK (no_pool >= 0);

-- Add side to bets (yes/no)
ALTER TABLE public.bets
  ADD COLUMN IF NOT EXISTS side text CHECK (side IN ('yes', 'no')) DEFAULT 'yes';

-- Backfill YES pools from existing total_pool values
UPDATE public.options
SET yes_pool = COALESCE(total_pool, 0)
WHERE yes_pool IS NULL OR yes_pool = 0;

-- Backfill existing bets to YES side
UPDATE public.bets
SET side = 'yes'
WHERE side IS NULL;
