-- Fix: Wrap auth.uid()/auth.role() in (select ...) for simple RLS policies
-- This prevents re-evaluation per row and improves performance.

-- ============================================================================
-- users table (simple policies only)
-- ============================================================================

DROP POLICY IF EXISTS "users_update_self" ON public.users;
CREATE POLICY "users_update_self"
    ON public.users
    FOR UPDATE
    USING ((select auth.uid()) = id)
    WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
    ON public.users
    FOR UPDATE
    USING ((select auth.uid()) = id)
    WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "users_insert_self" ON public.users;
CREATE POLICY "users_insert_self"
    ON public.users
    FOR INSERT
    WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile"
    ON public.users
    FOR INSERT
    WITH CHECK ((select auth.uid()) = id);

-- ============================================================================
-- wallets table
-- ============================================================================

DROP POLICY IF EXISTS "wallets_select_own" ON public.wallets;
CREATE POLICY "wallets_select_own"
    ON public.wallets
    FOR SELECT
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own wallet" ON public.wallets;
CREATE POLICY "Users can view their own wallet"
    ON public.wallets
    FOR SELECT
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "wallets_insert_own" ON public.wallets;
CREATE POLICY "wallets_insert_own"
    ON public.wallets
    FOR INSERT
    WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- wallet_transactions table
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Users can view own wallet transactions"
    ON public.wallet_transactions
    FOR SELECT
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own transactions" ON public.wallet_transactions;
CREATE POLICY "Users can view their own transactions"
    ON public.wallet_transactions
    FOR SELECT
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Users can view their own wallet transactions"
    ON public.wallet_transactions
    FOR SELECT
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Users can create own wallet transactions"
    ON public.wallet_transactions
    FOR INSERT
    WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- transactions table
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
CREATE POLICY "Users can view their own transactions"
    ON public.transactions
    FOR SELECT
    USING ((select auth.uid()) = user_id);

-- ============================================================================
-- user_engagement table
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own engagement" ON public.user_engagement;
CREATE POLICY "Users can view own engagement"
    ON public.user_engagement
    FOR SELECT
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own engagement" ON public.user_engagement;
CREATE POLICY "Users can insert own engagement"
    ON public.user_engagement
    FOR INSERT
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own engagement" ON public.user_engagement;
CREATE POLICY "Users can update own engagement"
    ON public.user_engagement
    FOR UPDATE
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- payout_requests table
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own payout requests" ON public.payout_requests;
CREATE POLICY "Users can view their own payout requests"
    ON public.payout_requests
    FOR SELECT
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert payout requests" ON public.payout_requests;
CREATE POLICY "Users can insert payout requests"
    ON public.payout_requests
    FOR INSERT
    WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- market_likes table
-- ============================================================================

DROP POLICY IF EXISTS "Users can like markets" ON public.market_likes;
CREATE POLICY "Users can like markets"
    ON public.market_likes
    FOR INSERT
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can unlike markets" ON public.market_likes;
CREATE POLICY "Users can unlike markets"
    ON public.market_likes
    FOR DELETE
    USING ((select auth.uid()) = user_id);

-- ============================================================================
-- market_shares table
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can create own shares" ON public.market_shares;
CREATE POLICY "Authenticated users can create own shares"
    ON public.market_shares
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (select auth.uid()));

-- ============================================================================
-- stripe_events table
-- ============================================================================

DROP POLICY IF EXISTS "Service role only" ON public.stripe_events;
CREATE POLICY "Service role only"
    ON public.stripe_events
    FOR ALL
    USING ((select auth.role()) = 'service_role')
    WITH CHECK ((select auth.role()) = 'service_role');
