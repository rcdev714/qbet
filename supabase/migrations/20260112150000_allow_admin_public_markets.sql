-- Allow admins to create public markets (which have no group_id)
-- This policy addresses the 42501 error when creating feed items

CREATE POLICY "Admins can create public markets" ON public.markets
  FOR INSERT WITH CHECK (
    is_public = true AND
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );
