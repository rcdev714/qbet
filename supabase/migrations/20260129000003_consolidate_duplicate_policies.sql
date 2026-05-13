-- Consolidate duplicate/overlapping RLS policies to reduce evaluation overhead.
-- This removes redundant policies or merges them into a single equivalent policy.

-- ============================================================================
-- bets table
-- ============================================================================

-- Drop redundant/deny policies
DROP POLICY IF EXISTS "bets_insert_none" ON public.bets;
DROP POLICY IF EXISTS "Users can view their own bets" ON public.bets;
DROP POLICY IF EXISTS "bets_select_group_member" ON public.bets;

-- ============================================================================
-- group_members table
-- ============================================================================

-- Keep the most permissive insert policy, drop redundant ones
DROP POLICY IF EXISTS "group_members_insert_admin" ON public.group_members;
DROP POLICY IF EXISTS "group_members_insert_self" ON public.group_members;

-- Public view policy already allows all, drop redundant restriction
DROP POLICY IF EXISTS "group_members_select_own_or_same_group" ON public.group_members;

-- ============================================================================
-- groups table
-- ============================================================================

-- Remove duplicate insert policy
DROP POLICY IF EXISTS "groups_insert_any_auth" ON public.groups;

-- Remove redundant select policy (public read already allowed)
DROP POLICY IF EXISTS "groups_select_member_or_admin" ON public.groups;

-- Merge update policies into one
DROP POLICY IF EXISTS "Admins can update groups" ON public.groups;
DROP POLICY IF EXISTS "groups_update_admin" ON public.groups;
CREATE POLICY "groups_update_admin"
    ON public.groups
    FOR UPDATE
    USING (
        (select auth.uid()) = admin_id
        OR is_group_admin(id, (select auth.uid()))
    )
    WITH CHECK (
        (select auth.uid()) = admin_id
        OR is_group_admin(id, (select auth.uid()))
    );

-- Merge delete policies into one
DROP POLICY IF EXISTS "Admins can delete groups" ON public.groups;
DROP POLICY IF EXISTS "groups_delete_admin" ON public.groups;
CREATE POLICY "groups_delete_admin"
    ON public.groups
    FOR DELETE
    USING (
        (select auth.uid()) = admin_id
        OR is_group_admin(id, (select auth.uid()))
    );

-- ============================================================================
-- markets table
-- ============================================================================

-- Remove redundant select policy (public read already allowed)
DROP POLICY IF EXISTS "markets_select_group_member" ON public.markets;

-- Merge insert policies into one
DROP POLICY IF EXISTS "Admins can create public markets" ON public.markets;
DROP POLICY IF EXISTS "Group members can create markets" ON public.markets;
DROP POLICY IF EXISTS "markets_insert_admin" ON public.markets;
CREATE POLICY "markets_insert_any"
    ON public.markets
    FOR INSERT
    WITH CHECK (
        (is_public = true AND EXISTS (
            SELECT 1
            FROM users
            WHERE users.id = (select auth.uid())
              AND users.is_admin = true
        ))
        OR (
            (select auth.uid()) = creator_id
            AND EXISTS (
                SELECT 1
                FROM group_members gm
                WHERE gm.group_id = markets.group_id
                  AND gm.user_id = (select auth.uid())
            )
        )
        OR (
            is_group_admin(group_id, (select auth.uid()))
            AND (select auth.uid()) = creator_id
        )
    );

-- Merge update policies into one
DROP POLICY IF EXISTS "Market creators can update markets" ON public.markets;
DROP POLICY IF EXISTS "markets_update_admin" ON public.markets;
CREATE POLICY "markets_update_any"
    ON public.markets
    FOR UPDATE
    USING (
        (select auth.uid()) = creator_id
        OR is_group_admin(group_id, (select auth.uid()))
    )
    WITH CHECK (
        (select auth.uid()) = creator_id
        OR is_group_admin(group_id, (select auth.uid()))
    );

-- ============================================================================
-- messages table
-- ============================================================================

-- Keep the broader insert policy
DROP POLICY IF EXISTS "Group members can send messages" ON public.messages;

-- Keep a single select policy
DROP POLICY IF EXISTS "Group members can view messages" ON public.messages;

-- ============================================================================
-- options table
-- ============================================================================

-- Keep the broader insert policy and public read
DROP POLICY IF EXISTS "options_insert_admin" ON public.options;
DROP POLICY IF EXISTS "options_select_group_member" ON public.options;

-- ============================================================================
-- users table
-- ============================================================================

-- Public profiles already viewable, drop redundant select policy
DROP POLICY IF EXISTS "users_select_own_or_member" ON public.users;

-- Remove duplicate insert/update policies
DROP POLICY IF EXISTS "users_insert_self" ON public.users;
DROP POLICY IF EXISTS "users_update_self" ON public.users;

-- ============================================================================
-- wallet_transactions table
-- ============================================================================

-- Keep a single select policy
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Users can view their own wallet transactions" ON public.wallet_transactions;

-- ============================================================================
-- wallets table
-- ============================================================================

-- Keep a single select policy
DROP POLICY IF EXISTS "wallets_select_own" ON public.wallets;
