-- Enable cascade delete for markets and associated data
-- This ensures that when a market is deleted, all its options and bets are also removed.

-- 1. Update options -> markets FK
ALTER TABLE public.options
DROP CONSTRAINT IF EXISTS options_market_id_fkey;

ALTER TABLE public.options
ADD CONSTRAINT options_market_id_fkey
FOREIGN KEY (market_id)
REFERENCES public.markets(id)
ON DELETE CASCADE;

-- 2. Update bets -> markets FK
ALTER TABLE public.bets
DROP CONSTRAINT IF EXISTS bets_market_id_fkey;

ALTER TABLE public.bets
ADD CONSTRAINT bets_market_id_fkey
FOREIGN KEY (market_id)
REFERENCES public.markets(id)
ON DELETE CASCADE;

-- 3. Update bets -> options FK
ALTER TABLE public.bets
DROP CONSTRAINT IF EXISTS bets_option_id_fkey;

ALTER TABLE public.bets
ADD CONSTRAINT bets_option_id_fkey
FOREIGN KEY (option_id)
REFERENCES public.options(id)
ON DELETE CASCADE;
