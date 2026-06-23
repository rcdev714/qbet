begin;

-- ============================================================================
-- Beta approval notification: token, email tracking, resolve RPC
-- ============================================================================

alter table public.beta_access_requests
  add column if not exists approval_token uuid,
  add column if not exists approval_email_sent_at timestamptz;

create unique index if not exists idx_beta_access_requests_approval_token
  on public.beta_access_requests (approval_token)
  where approval_token is not null;

-- Backfill tokens for already-approved rows (email links for legacy approvals)
update public.beta_access_requests
set approval_token = gen_random_uuid()
where status = 'approved'
  and approval_token is null;

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
  v_user_id uuid;
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

  select id into v_user_id
  from public.users
  where lower(email) = v_request.email
  limit 1;

  update public.beta_access_requests
  set status = 'approved',
      reviewed_by = v_admin,
      reviewed_at = now(),
      admin_notes = p_admin_notes,
      approval_token = gen_random_uuid()
  where id = p_request_id
  returning * into v_request;

  if v_user_id is not null then
    perform public.create_notification(
      v_user_id,
      'beta_approved',
      'Beta access approved',
      'Your AnyMarket beta request was approved. Continue onboarding to start using the app.',
      jsonb_build_object(
        'request_id', v_request.id,
        'approval_token', v_request.approval_token
      )
    );
  end if;

  return v_request;
end;
$$;

create or replace function public.resolve_beta_approval_token(p_token uuid)
returns table (
  email text,
  status text,
  full_name text,
  country_code text,
  request_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    bar.email,
    bar.status,
    bar.full_name,
    bar.country_code,
    bar.id as request_id
  from public.beta_access_requests bar
  where bar.approval_token = p_token
    and bar.status = 'approved'
  limit 1;
$$;

create or replace function public.mark_beta_approval_email_sent(p_request_id uuid)
returns public.beta_access_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.beta_access_requests;
begin
  update public.beta_access_requests
  set approval_email_sent_at = now()
  where id = p_request_id
    and status = 'approved'
  returning * into v_request;

  if v_request.id is null then
    raise exception 'Approved request not found';
  end if;

  return v_request;
end;
$$;

grant execute on function public.resolve_beta_approval_token(uuid) to anon, authenticated;
grant execute on function public.mark_beta_approval_email_sent(uuid) to service_role;

commit;
