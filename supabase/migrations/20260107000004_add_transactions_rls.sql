ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;

CREATE POLICY "Users can view their own transactions" 
ON public.transactions 
FOR SELECT 
USING (auth.uid() = user_id);

-- Also allow service role to do anything (usually default, but good to ensure if needed, though policies are for row security)
-- Insert policy? Functions use SECURITY DEFINER so they might bypass RLS, but if we want users to insert via client (unlikely here, backend functions do it), we normally don't add insert policy for financial logs.
-- Everything is done via SECURITY DEFINER functions (place_bet, resolve_market, add_funds), so user doesn't need INSERT/UPDATE.
