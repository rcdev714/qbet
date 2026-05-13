-- Fix: Overly permissive INSERT policy on market_shares
-- The previous policy allowed anyone to insert any row, including spoofing user_id
-- 
-- New policy:
--   - Authenticated users can only insert shares with their own user_id
--   - Anonymous users can only insert shares with NULL user_id
--   - This prevents impersonation while still allowing anonymous share tracking

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can create shares" ON public.market_shares;

-- Create a more restrictive policy for authenticated users
CREATE POLICY "Authenticated users can create own shares"
    ON public.market_shares
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Create a policy for anonymous users (user_id must be NULL)
CREATE POLICY "Anonymous users can create shares without user_id"
    ON public.market_shares
    FOR INSERT
    TO anon
    WITH CHECK (user_id IS NULL);
