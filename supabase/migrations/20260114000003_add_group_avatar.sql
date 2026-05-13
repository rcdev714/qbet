-- Add avatar_url to groups table
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Update RLS policies (if any depend on existing columns, they should be fine as avatar_url is public-ish)
-- Most queries for group are already restricted by membership.
