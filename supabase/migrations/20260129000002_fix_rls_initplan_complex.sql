-- Fix: Wrap auth.uid() in (select ...) for complex RLS policies
-- This prevents per-row re-evaluation in EXISTS and function calls.

-- ============================================================================
-- users table (complex SELECT policy)
-- ============================================================================

DROP POLICY IF EXISTS "users_select_own_or_member" ON public.users;
CREATE POLICY "users_select_own_or_member"
    ON public.users
    FOR SELECT
    USING (
        (select auth.uid()) = id
        OR EXISTS (
            SELECT 1
            FROM group_members gm
            JOIN group_members gm2 ON gm2.group_id = gm.group_id
            WHERE gm.user_id = (select auth.uid())
            AND gm2.user_id = users.id
        )
    );

-- ============================================================================
-- bets table
-- ============================================================================

DROP POLICY IF EXISTS "Users can place bets" ON public.bets;
CREATE POLICY "Users can place bets"
    ON public.bets
    FOR INSERT
    WITH CHECK (
        (select auth.uid()) = user_id
        AND (
            EXISTS (
                SELECT 1
                FROM markets m
                WHERE m.id = bets.market_id
                  AND m.is_public = true
            )
            OR EXISTS (
                SELECT 1
                FROM markets m
                JOIN group_members gm ON gm.group_id = m.group_id
                WHERE m.id = bets.market_id
                  AND gm.user_id = (select auth.uid())
            )
        )
    );

DROP POLICY IF EXISTS "Users can view bets" ON public.bets;
CREATE POLICY "Users can view bets"
    ON public.bets
    FOR SELECT
    USING (
        (select auth.uid()) = user_id
        OR EXISTS (
            SELECT 1
            FROM markets m
            WHERE m.id = bets.market_id
              AND m.is_public = true
        )
        OR EXISTS (
            SELECT 1
            FROM markets m
            JOIN group_members gm ON gm.group_id = m.group_id
            WHERE m.id = bets.market_id
              AND gm.user_id = (select auth.uid())
        )
    );

DROP POLICY IF EXISTS "Users can view their own bets" ON public.bets;
CREATE POLICY "Users can view their own bets"
    ON public.bets
    FOR SELECT
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "bets_select_group_member" ON public.bets;
CREATE POLICY "bets_select_group_member"
    ON public.bets
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM markets m
            WHERE m.id = bets.market_id
              AND is_group_member(m.group_id, (select auth.uid()))
        )
    );

-- ============================================================================
-- groups table
-- ============================================================================

DROP POLICY IF EXISTS "Admins can delete groups" ON public.groups;
CREATE POLICY "Admins can delete groups"
    ON public.groups
    FOR DELETE
    USING ((select auth.uid()) = admin_id);

DROP POLICY IF EXISTS "groups_delete_admin" ON public.groups;
CREATE POLICY "groups_delete_admin"
    ON public.groups
    FOR DELETE
    USING (is_group_admin(id, (select auth.uid())));

DROP POLICY IF EXISTS "Users can create groups" ON public.groups;
CREATE POLICY "Users can create groups"
    ON public.groups
    FOR INSERT
    WITH CHECK ((select auth.uid()) = admin_id);

DROP POLICY IF EXISTS "groups_insert_any_auth" ON public.groups;
CREATE POLICY "groups_insert_any_auth"
    ON public.groups
    FOR INSERT
    WITH CHECK ((select auth.uid()) = admin_id);

DROP POLICY IF EXISTS "groups_select_member_or_admin" ON public.groups;
CREATE POLICY "groups_select_member_or_admin"
    ON public.groups
    FOR SELECT
    USING (
        (select auth.uid()) = admin_id
        OR is_group_member(id, (select auth.uid()))
    );

DROP POLICY IF EXISTS "Admins can update groups" ON public.groups;
CREATE POLICY "Admins can update groups"
    ON public.groups
    FOR UPDATE
    USING ((select auth.uid()) = admin_id);

DROP POLICY IF EXISTS "groups_update_admin" ON public.groups;
CREATE POLICY "groups_update_admin"
    ON public.groups
    FOR UPDATE
    USING (is_group_admin(id, (select auth.uid())))
    WITH CHECK (is_group_admin(id, (select auth.uid())));

-- ============================================================================
-- group_members table
-- ============================================================================

DROP POLICY IF EXISTS "group_members_delete_self_or_admin" ON public.group_members;
CREATE POLICY "group_members_delete_self_or_admin"
    ON public.group_members
    FOR DELETE
    USING (
        (select auth.uid()) = user_id
        OR is_group_admin(group_id, (select auth.uid()))
    );

DROP POLICY IF EXISTS "Members can be added to groups" ON public.group_members;
CREATE POLICY "Members can be added to groups"
    ON public.group_members
    FOR INSERT
    WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "group_members_insert_admin" ON public.group_members;
CREATE POLICY "group_members_insert_admin"
    ON public.group_members
    FOR INSERT
    WITH CHECK (is_group_admin(group_id, (select auth.uid())));

DROP POLICY IF EXISTS "group_members_insert_self" ON public.group_members;
CREATE POLICY "group_members_insert_self"
    ON public.group_members
    FOR INSERT
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "group_members_select_own_or_same_group" ON public.group_members;
CREATE POLICY "group_members_select_own_or_same_group"
    ON public.group_members
    FOR SELECT
    USING (
        (select auth.uid()) = user_id
        OR is_group_member(group_id, (select auth.uid()))
    );

DROP POLICY IF EXISTS "group_members_update_admin" ON public.group_members;
CREATE POLICY "group_members_update_admin"
    ON public.group_members
    FOR UPDATE
    USING (is_group_admin(group_id, (select auth.uid())))
    WITH CHECK (is_group_admin(group_id, (select auth.uid())));

-- ============================================================================
-- invites table
-- ============================================================================

DROP POLICY IF EXISTS "invites_select_group_member" ON public.invites;
CREATE POLICY "invites_select_group_member"
    ON public.invites
    FOR SELECT
    USING (is_group_member(group_id, (select auth.uid())));

DROP POLICY IF EXISTS "invites_insert_admin" ON public.invites;
CREATE POLICY "invites_insert_admin"
    ON public.invites
    FOR INSERT
    WITH CHECK (is_group_admin(group_id, (select auth.uid())));

DROP POLICY IF EXISTS "invites_update_admin" ON public.invites;
CREATE POLICY "invites_update_admin"
    ON public.invites
    FOR UPDATE
    USING (is_group_admin(group_id, (select auth.uid())))
    WITH CHECK (is_group_admin(group_id, (select auth.uid())));

-- ============================================================================
-- markets table
-- ============================================================================

DROP POLICY IF EXISTS "Admins can delete markets" ON public.markets;
CREATE POLICY "Admins can delete markets"
    ON public.markets
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1
            FROM users
            WHERE users.id = (select auth.uid())
              AND users.is_admin = true
        )
    );

DROP POLICY IF EXISTS "Admins can create public markets" ON public.markets;
CREATE POLICY "Admins can create public markets"
    ON public.markets
    FOR INSERT
    WITH CHECK (
        is_public = true
        AND EXISTS (
            SELECT 1
            FROM users
            WHERE users.id = (select auth.uid())
              AND users.is_admin = true
        )
    );

DROP POLICY IF EXISTS "Group members can create markets" ON public.markets;
CREATE POLICY "Group members can create markets"
    ON public.markets
    FOR INSERT
    WITH CHECK (
        (select auth.uid()) = creator_id
        AND EXISTS (
            SELECT 1
            FROM group_members gm
            WHERE gm.group_id = markets.group_id
              AND gm.user_id = (select auth.uid())
        )
    );

DROP POLICY IF EXISTS "markets_insert_admin" ON public.markets;
CREATE POLICY "markets_insert_admin"
    ON public.markets
    FOR INSERT
    WITH CHECK (
        is_group_admin(group_id, (select auth.uid()))
        AND (select auth.uid()) = creator_id
    );

DROP POLICY IF EXISTS "markets_select_group_member" ON public.markets;
CREATE POLICY "markets_select_group_member"
    ON public.markets
    FOR SELECT
    USING (is_group_member(group_id, (select auth.uid())));

DROP POLICY IF EXISTS "Market creators can update markets" ON public.markets;
CREATE POLICY "Market creators can update markets"
    ON public.markets
    FOR UPDATE
    USING ((select auth.uid()) = creator_id);

DROP POLICY IF EXISTS "markets_update_admin" ON public.markets;
CREATE POLICY "markets_update_admin"
    ON public.markets
    FOR UPDATE
    USING (is_group_admin(group_id, (select auth.uid())))
    WITH CHECK (is_group_admin(group_id, (select auth.uid())));

-- ============================================================================
-- messages table
-- ============================================================================

DROP POLICY IF EXISTS "Group members can send messages" ON public.messages;
CREATE POLICY "Group members can send messages"
    ON public.messages
    FOR INSERT
    WITH CHECK (
        (select auth.uid()) = user_id
        AND EXISTS (
            SELECT 1
            FROM group_members gm
            WHERE gm.group_id = messages.group_id
              AND gm.user_id = (select auth.uid())
        )
    );

DROP POLICY IF EXISTS "Users can insert messages in their groups" ON public.messages;
CREATE POLICY "Users can insert messages in their groups"
    ON public.messages
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM group_members
            WHERE group_members.group_id = messages.group_id
              AND group_members.user_id = (select auth.uid())
        )
    );

DROP POLICY IF EXISTS "Group members can view messages" ON public.messages;
CREATE POLICY "Group members can view messages"
    ON public.messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM group_members gm
            WHERE gm.group_id = messages.group_id
              AND gm.user_id = (select auth.uid())
        )
    );

DROP POLICY IF EXISTS "Users can view messages in their groups" ON public.messages;
CREATE POLICY "Users can view messages in their groups"
    ON public.messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM group_members
            WHERE group_members.group_id = messages.group_id
              AND group_members.user_id = (select auth.uid())
        )
    );

-- ============================================================================
-- options table
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can create options" ON public.options;
CREATE POLICY "Authenticated users can create options"
    ON public.options
    FOR INSERT
    WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "options_insert_admin" ON public.options;
CREATE POLICY "options_insert_admin"
    ON public.options
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM markets m
            WHERE m.id = options.market_id
              AND is_group_admin(m.group_id, (select auth.uid()))
        )
    );

DROP POLICY IF EXISTS "options_select_group_member" ON public.options;
CREATE POLICY "options_select_group_member"
    ON public.options
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM markets m
            WHERE m.id = options.market_id
              AND is_group_member(m.group_id, (select auth.uid()))
        )
    );

-- ============================================================================
-- market_chat_messages table
-- ============================================================================

DROP POLICY IF EXISTS "Send messages on public markets" ON public.market_chat_messages;
CREATE POLICY "Send messages on public markets"
    ON public.market_chat_messages
    FOR INSERT
    WITH CHECK (
        (select auth.uid()) = user_id
        AND EXISTS (
            SELECT 1
            FROM markets
            WHERE markets.id = market_chat_messages.market_id
              AND markets.is_public = true
        )
    );
