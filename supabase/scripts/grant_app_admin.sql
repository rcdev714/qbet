-- Grant app admin (users.is_admin) for resolve/delete RPCs and market DELETE RLS.
-- Run in production Supabase SQL Editor. Replace the email below if needed.

-- 1. Verify current state
SELECT id, email, is_admin
FROM public.users
WHERE email ILIKE '%juan.salgador@uisek.edu.ec%';

-- 2. Grant admin (required for resolve_public_market and market deletion)
UPDATE public.users
SET is_admin = true
WHERE email = 'juan.salgador@uisek.edu.ec';

-- 3. Inspect stuck public markets (open or closed, not yet resolved)
SELECT id, question, status, is_public, closes_at, created_at
FROM public.markets
WHERE is_public = true
  AND status IN ('open', 'closed')
ORDER BY created_at ASC;
