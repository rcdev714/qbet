-- Allow public markets to have no group (NULL group_id)
-- Public markets are visible to all users and don't belong to any specific group

alter table public.markets
  alter column group_id drop not null;

-- Add a comment explaining the change
comment on column public.markets.group_id is 'The group this market belongs to. NULL for public markets that appear in the global feed.';
