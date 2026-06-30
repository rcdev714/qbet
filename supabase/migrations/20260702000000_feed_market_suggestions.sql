begin;

-- Batch run log for Gemini feed suggestion cron (observability + idempotency).
create table if not exists public.feed_suggestion_batches (
  id uuid primary key default gen_random_uuid(),
  cron_slot text not null check (cron_slot in ('08:00', '12:00', '15:00')),
  run_date date not null,
  status text not null check (status in ('running', 'completed', 'failed', 'skipped')),
  triggered_by text not null check (triggered_by in ('pg_cron', 'manual')),
  suggestion_count int not null default 0,
  error_message text,
  gemini_model text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint feed_suggestion_batches_run_date_slot_key unique (run_date, cron_slot)
);

create index if not exists idx_feed_suggestion_batches_run_date
  on public.feed_suggestion_batches (run_date desc, cron_slot);

-- Admin-only suggestion queue (not public until promoted to a market).
create table if not exists public.feed_market_suggestions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.feed_suggestion_batches (id) on delete cascade,
  category text not null check (category in ('Entertainment', 'Tech', 'Economy')),
  subject text not null,
  horizon text not null check (horizon in ('near_term', 'long_term')),
  question text not null,
  description text,
  options jsonb not null,
  suggested_closes_at timestamptz not null,
  source_urls jsonb not null default '[]'::jsonb,
  search_queries jsonb not null default '[]'::jsonb,
  rationale text,
  status text not null default 'pending' check (status in ('pending', 'dismissed', 'created')),
  created_market_id uuid references public.markets (id) on delete set null,
  reviewed_by uuid references public.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_feed_market_suggestions_status_created
  on public.feed_market_suggestions (status, created_at desc);

create index if not exists idx_feed_market_suggestions_batch_id
  on public.feed_market_suggestions (batch_id);

alter table public.feed_suggestion_batches enable row level security;
alter table public.feed_market_suggestions enable row level security;

-- Admin read access
drop policy if exists "Admins can read feed suggestion batches" on public.feed_suggestion_batches;
create policy "Admins can read feed suggestion batches"
  on public.feed_suggestion_batches
  for select
  to authenticated
  using (public.is_app_admin(auth.uid()));

drop policy if exists "Admins can read feed market suggestions" on public.feed_market_suggestions;
create policy "Admins can read feed market suggestions"
  on public.feed_market_suggestions
  for select
  to authenticated
  using (public.is_app_admin(auth.uid()));

drop policy if exists "Admins can update feed market suggestions" on public.feed_market_suggestions;
create policy "Admins can update feed market suggestions"
  on public.feed_market_suggestions
  for update
  to authenticated
  using (public.is_app_admin(auth.uid()))
  with check (public.is_app_admin(auth.uid()));

-- Admin dismiss suggestion
create or replace function public.admin_dismiss_feed_suggestion(p_id uuid)
returns public.feed_market_suggestions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_row public.feed_market_suggestions;
begin
  if v_admin is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if public.is_app_admin(v_admin) is not true then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  update public.feed_market_suggestions
  set
    status = 'dismissed',
    reviewed_by = v_admin,
    reviewed_at = now()
  where id = p_id
    and status = 'pending'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Suggestion not found or not pending' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

-- Admin link suggestion to created market
create or replace function public.admin_mark_suggestion_created(
  p_id uuid,
  p_market_id uuid
)
returns public.feed_market_suggestions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_row public.feed_market_suggestions;
begin
  if v_admin is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if public.is_app_admin(v_admin) is not true then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if not exists (select 1 from public.markets m where m.id = p_market_id) then
    raise exception 'Market not found' using errcode = 'P0002';
  end if;

  update public.feed_market_suggestions
  set
    status = 'created',
    created_market_id = p_market_id,
    reviewed_by = v_admin,
    reviewed_at = now()
  where id = p_id
    and status = 'pending'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Suggestion not found or not pending' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

grant execute on function public.admin_dismiss_feed_suggestion(uuid) to authenticated;
grant execute on function public.admin_mark_suggestion_created(uuid, uuid) to authenticated;

commit;
