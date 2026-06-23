begin;

-- ============================================================================
-- Beta access requests: public form queue + admin approve/decline
-- ============================================================================

create table if not exists public.beta_access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  full_name text,
  country_code text not null,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined')),
  user_id uuid references public.users(id) on delete set null,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_beta_access_requests_status_created
  on public.beta_access_requests (status, created_at desc);

create unique index if not exists idx_beta_access_requests_pending_email
  on public.beta_access_requests (email)
  where status = 'pending';

alter table public.beta_access_requests enable row level security;

-- No direct client policies; all access via RPCs.

create or replace function public.submit_beta_access_request(
  p_email text,
  p_full_name text default null,
  p_country_code text default null,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_country text := upper(trim(coalesce(p_country_code, '')));
  v_user_id uuid := auth.uid();
  v_existing_id uuid;
  v_id uuid;
begin
  if v_email is null or v_email = '' then
    raise exception 'Email is required';
  end if;

  if v_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' then
    raise exception 'Invalid email address';
  end if;

  if p_full_name is null or trim(p_full_name) = '' then
    raise exception 'Full name is required';
  end if;

  if v_country = '' then
    raise exception 'Country is required';
  end if;

  if not exists (
    select 1 from public.supported_residence_countries src
    where src.country_code = v_country and src.is_launch_enabled is true
  ) then
    raise exception 'Country is not available for launch';
  end if;

  select id into v_existing_id
  from public.beta_access_requests
  where email = v_email and status = 'pending'
  limit 1;

  if v_existing_id is not null then
    raise exception 'ALREADY_SUBMITTED' using errcode = 'P0001';
  end if;

  insert into public.beta_access_requests (
    email, full_name, country_code, message, user_id
  ) values (
    v_email,
    trim(p_full_name),
    v_country,
    nullif(trim(p_message), ''),
    v_user_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.list_beta_access_requests(
  p_status text default 'pending'
)
returns setof public.beta_access_requests
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.beta_access_requests bar
  where public.is_app_admin(auth.uid())
    and (p_status is null or bar.status = p_status)
  order by bar.created_at desc
  limit 500;
$$;

create or replace function public.get_beta_access_request_by_email(
  p_email text
)
returns public.beta_access_requests
language sql
stable
security definer
set search_path = public
as $$
  select bar.*
  from public.beta_access_requests bar
  where bar.email = lower(trim(p_email))
  order by bar.created_at desc
  limit 1;
$$;

create or replace function public.approve_beta_access_request(
  p_request_id uuid,
  p_admin_notes text default null
)
returns public.beta_access_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_request public.beta_access_requests;
begin
  if public.is_app_admin(v_admin) is not true then
    raise exception 'Admin only';
  end if;

  select * into v_request
  from public.beta_access_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'Request not found';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'Request is not pending';
  end if;

  insert into public.beta_invites (email, notes)
  values (v_request.email, coalesce(p_admin_notes, 'Approved via access request'))
  on conflict (email) do update
    set notes = coalesce(excluded.notes, public.beta_invites.notes);

  update public.users
  set beta_approved = true
  where lower(email) = v_request.email;

  update public.beta_access_requests
  set status = 'approved',
      reviewed_by = v_admin,
      reviewed_at = now(),
      admin_notes = p_admin_notes
  where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

create or replace function public.decline_beta_access_request(
  p_request_id uuid,
  p_admin_notes text default null
)
returns public.beta_access_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_request public.beta_access_requests;
begin
  if public.is_app_admin(v_admin) is not true then
    raise exception 'Admin only';
  end if;

  update public.beta_access_requests
  set status = 'declined',
      reviewed_by = v_admin,
      reviewed_at = now(),
      admin_notes = p_admin_notes
  where id = p_request_id
    and status = 'pending'
  returning * into v_request;

  if v_request.id is null then
    raise exception 'Request not found or not pending';
  end if;

  return v_request;
end;
$$;

grant execute on function public.submit_beta_access_request(text, text, text, text) to anon, authenticated;
grant execute on function public.list_beta_access_requests(text) to authenticated;
grant execute on function public.get_beta_access_request_by_email(text) to anon, authenticated;
grant execute on function public.approve_beta_access_request(uuid, text) to authenticated;
grant execute on function public.decline_beta_access_request(uuid, text) to authenticated;

commit;
