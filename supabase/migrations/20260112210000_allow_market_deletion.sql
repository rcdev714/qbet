-- Allow admins to delete markets
-- This policy allows users with is_admin=true to delete rows from the markets table.
-- Note: This is a powerful permission, ensure is_admin is only granted to trusted users.

CREATE POLICY "Admins can delete markets" ON public.markets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );
