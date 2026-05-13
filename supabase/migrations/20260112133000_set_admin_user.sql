-- Function to auto-grant admin to specific email
CREATE OR REPLACE FUNCTION public.auto_admin_grant()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email = 'juan.salgador@uisek.edu.ec' THEN
    NEW.is_admin := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger (before insert on public.users)
DROP TRIGGER IF EXISTS trg_auto_admin_grant ON public.users;
CREATE TRIGGER trg_auto_admin_grant
BEFORE INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_admin_grant();

-- Also try to update if user already exists (for existing data)
UPDATE public.users 
SET is_admin = TRUE 
WHERE email = 'juan.salgador@uisek.edu.ec';
