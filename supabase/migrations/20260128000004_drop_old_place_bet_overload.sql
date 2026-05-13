-- Fix: Drop deprecated 3-param place_bet overload
-- The 4-param version (with p_side) is the current implementation.
-- The old 3-param version is no longer used and causes duplicate linter warnings.

DROP FUNCTION IF EXISTS public.place_bet(uuid, uuid, numeric);
