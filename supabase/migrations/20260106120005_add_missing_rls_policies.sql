-- Add missing RLS policies for messages, markets, options, and bets
-- This migration fixes the issue where users cannot send messages or create predictions

-- Messages policies
CREATE POLICY "Group members can view messages" ON public.messages 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm 
      WHERE gm.group_id = messages.group_id 
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can send messages" ON public.messages 
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.group_members gm 
      WHERE gm.group_id = messages.group_id 
      AND gm.user_id = auth.uid()
    )
  );

-- Markets policies
CREATE POLICY "Anyone can view markets" ON public.markets 
  FOR SELECT USING (true);

CREATE POLICY "Group members can create markets" ON public.markets 
  FOR INSERT WITH CHECK (
    auth.uid() = creator_id AND
    EXISTS (
      SELECT 1 FROM public.group_members gm 
      WHERE gm.group_id = markets.group_id 
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Market creators can update markets" ON public.markets 
  FOR UPDATE USING (auth.uid() = creator_id);

-- Options policies
CREATE POLICY "Anyone can view options" ON public.options 
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create options" ON public.options 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Bets policies
CREATE POLICY "Users can view their own bets" ON public.bets 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Group members can view all bets in their groups" ON public.bets 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.markets m
      JOIN public.group_members gm ON gm.group_id = m.group_id
      WHERE m.id = bets.market_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can place bets" ON public.bets 
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.markets m
      JOIN public.group_members gm ON gm.group_id = m.group_id
      WHERE m.id = bets.market_id AND gm.user_id = auth.uid()
    )
  );

-- Wallet transactions policies  
CREATE POLICY "Users can view own wallet transactions" ON public.wallet_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own wallet transactions" ON public.wallet_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Group members INSERT policy (needed for creating groups)
CREATE POLICY "Members can be added to groups" ON public.group_members
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
