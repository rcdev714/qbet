-- Allow public markets to have no group (NULL group_id)
-- Public markets are visible to all users and don't belong to any specific group

ALTER TABLE public.markets 
ALTER COLUMN group_id DROP NOT NULL;

-- Add a comment explaining the change
COMMENT ON COLUMN public.markets.group_id IS 'The group this market belongs to. NULL for public markets that appear in the global feed.';

