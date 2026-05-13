-- Allow users to create their own wallet
-- This is necessary for the client-side fallback in auth.service.ts to work
-- when the database trigger fails or is bypassed.

CREATE POLICY "Users can create their own wallet"
    ON public.wallets
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
