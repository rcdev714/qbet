-- Allow betting on public markets (where group_id is null or is_public is true)
-- Existing policy restricted bets to group members only.

DROP POLICY IF EXISTS "Users can place bets" ON public.bets;

CREATE POLICY "Users can place bets" ON public.bets 
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    (
      -- Allow if market is public
      EXISTS (
        SELECT 1 FROM public.markets m
        WHERE m.id = bets.market_id 
        AND m.is_public = true
      )
      OR
      -- Allow if user is member of the market's group
      EXISTS (
        SELECT 1 FROM public.markets m
        JOIN public.group_members gm ON gm.group_id = m.group_id
        WHERE m.id = bets.market_id AND gm.user_id = auth.uid()
      )
    )
  );

-- Also update view policy to allow viewing bets on public markets
DROP POLICY IF EXISTS "Group members can view all bets in their groups" ON public.bets;

CREATE POLICY "Users can view bets" ON public.bets 
  FOR SELECT USING (
    -- User's own beats
    auth.uid() = user_id
    OR
    -- Bets on public markets
    EXISTS (
        SELECT 1 FROM public.markets m
        WHERE m.id = bets.market_id 
        AND m.is_public = true
    )
    OR
    -- Bets in groups user is member of
    EXISTS (
      SELECT 1 FROM public.markets m
      JOIN public.group_members gm ON gm.group_id = m.group_id
      WHERE m.id = bets.market_id AND gm.user_id = auth.uid()
    )
  );
