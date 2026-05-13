-- Fix: RLS enabled on stripe_events but no policies defined
-- This table should only be accessible by service_role (used by stripe webhook edge function)
-- 
-- With RLS enabled and no policies, access is already denied to authenticated/anon users.
-- Adding an explicit policy makes the intent clear and allows service_role access.

-- Policy: Only service_role can access stripe_events
-- Note: service_role bypasses RLS by default, but this documents intent
-- and ensures the table is explicitly locked down
CREATE POLICY "Service role only"
    ON public.stripe_events
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
