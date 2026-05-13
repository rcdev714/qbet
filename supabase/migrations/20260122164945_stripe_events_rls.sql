-- Lock down stripe_events to service role only

alter table public.stripe_events enable row level security;
