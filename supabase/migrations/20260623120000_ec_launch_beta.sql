begin;

-- ============================================================================
-- EC launch beta: scope lock, age attestation, beta allowlist, UGC, feed fix
-- ============================================================================

-- A. EC-only residence for launch
update public.supported_residence_countries
set is_launch_enabled = false
where country_code <> 'EC';

-- B. EC payment rails: Stripe fiat only for v1
update public.compliance_jurisdiction_rules
set allowed_payment_providers = array['stripe']::text[],
    allowed_crypto_assets = array[]::text[],
    notes = 'EC launch beta: Stripe fiat only. MoonPay and BTC payout disabled until counsel clearance.',
    updated_at = now()
where jurisdiction = 'EC';

-- C. Age attestation (signup eligibility; live money still requires Stripe Identity)
alter table public.user_compliance_profiles
  add column if not exists age_attested_at timestamptz;

create or replace function public.record_age_attestation()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  insert into public.user_compliance_profiles (user_id, age_attested_at)
  values (v_user_id, v_now)
  on conflict (user_id) do update
    set age_attested_at = coalesce(public.user_compliance_profiles.age_attested_at, v_now),
        updated_at = now();

  return v_now;
end;
$$;

grant execute on function public.record_age_attestation() to authenticated;

-- D. Private beta allowlist
create table if not exists public.beta_invites (
  email text primary key check (email = lower(email)),
  invited_at timestamptz not null default now(),
  used_at timestamptz,
  notes text
);

alter table public.users
  add column if not exists beta_approved boolean not null default false;

create or replace function public.sync_beta_access_on_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is true then
    new.beta_approved := true;
  elsif new.email is not null and exists (
    select 1 from public.beta_invites bi where bi.email = lower(new.email)
  ) then
    new.beta_approved := true;
    update public.beta_invites
    set used_at = coalesce(used_at, now())
    where email = lower(new.email);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_beta_access_on_user on public.users;
create trigger trg_sync_beta_access_on_user
  before insert or update of email, is_admin on public.users
  for each row execute function public.sync_beta_access_on_user();

-- Backfill existing users on invite list / admins
update public.users u
set beta_approved = true
where u.is_admin is true
   or exists (select 1 from public.beta_invites bi where bi.email = lower(u.email));

create or replace function public.user_has_beta_access(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = p_user_id
      and (u.beta_approved is true or u.is_admin is true)
  );
$$;

grant execute on function public.user_has_beta_access(uuid) to authenticated;

-- E. UGC moderation
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id) on delete cascade,
  target_type text not null check (target_type in ('market_chat_message', 'group_message', 'user_profile')),
  target_id text not null,
  target_user_id uuid references public.users(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  admin_notes text,
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_content_reports_status_created
  on public.content_reports (status, created_at desc);

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists idx_user_blocks_blocker on public.user_blocks (blocker_id);

alter table public.content_reports enable row level security;
alter table public.user_blocks enable row level security;

create policy content_reports_insert_own on public.content_reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

create policy content_reports_select_own on public.content_reports
  for select to authenticated
  using (reporter_id = auth.uid() or public.is_app_admin(auth.uid()));

create policy user_blocks_own on public.user_blocks
  for all to authenticated
  using (blocker_id = auth.uid())
  with check (blocker_id = auth.uid());

create policy user_blocks_select_blocked on public.user_blocks
  for select to authenticated
  using (blocked_id = auth.uid() or blocker_id = auth.uid());

create or replace function public.report_content(
  p_target_type text,
  p_target_id text,
  p_target_user_id uuid default null,
  p_reason text default 'other',
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.content_reports (
    reporter_id, target_type, target_id, target_user_id, reason, details
  ) values (
    v_user_id, p_target_type, p_target_id, p_target_user_id, p_reason, p_details
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.block_user(p_blocked_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_blocked_id = v_user_id then
    raise exception 'Cannot block yourself';
  end if;

  insert into public.user_blocks (blocker_id, blocked_id)
  values (v_user_id, p_blocked_id)
  on conflict do nothing;

  return true;
end;
$$;

create or replace function public.unblock_user(p_blocked_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.user_blocks
  where blocker_id = v_user_id and blocked_id = p_blocked_id;

  return true;
end;
$$;

create or replace function public.is_user_blocked(p_viewer_id uuid, p_target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_blocks ub
    where (ub.blocker_id = p_viewer_id and ub.blocked_id = p_target_id)
       or (ub.blocker_id = p_target_id and ub.blocked_id = p_viewer_id)
  );
$$;

create or replace function public.list_content_reports(p_status text default 'open')
returns setof public.content_reports
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.content_reports cr
  where public.is_app_admin(auth.uid())
    and (p_status is null or cr.status = p_status)
  order by cr.created_at desc
  limit 200;
$$;

create or replace function public.resolve_content_report(
  p_report_id uuid,
  p_status text,
  p_admin_notes text default null,
  p_restrict_user boolean default false
)
returns public.content_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_report public.content_reports;
begin
  if public.is_app_admin(v_admin) is not true then
    raise exception 'Admin only';
  end if;

  update public.content_reports
  set status = p_status,
      admin_notes = p_admin_notes,
      resolved_by = v_admin,
      resolved_at = now()
  where id = p_report_id
  returning * into v_report;

  if v_report.id is null then
    raise exception 'Report not found';
  end if;

  if p_restrict_user and v_report.target_user_id is not null then
    update public.user_compliance_profiles
    set review_status = 'frozen',
        restriction_reason = coalesce(p_admin_notes, 'UGC moderation action'),
        restricted_at = now(),
        updated_at = now()
    where user_id = v_report.target_user_id;
  end if;

  return v_report;
end;
$$;

grant execute on function public.report_content(text, text, uuid, text, text) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.is_user_blocked(uuid, uuid) to authenticated;
grant execute on function public.list_content_reports(text) to authenticated;
grant execute on function public.resolve_content_report(uuid, text, text, boolean) to authenticated;

-- F. Re-evaluate public feed visibility from compliance taxonomy
update public.markets m
set public_feed_allowed = false,
    compliance_review_state = coalesce(mcr.review_state, 'pending'),
    sensitivity_tier = coalesce(mcr.sensitivity_tier, m.sensitivity_tier, 'standard'),
    market_category = coalesce(mcr.category, m.market_category, 'general_event')
from public.market_compliance_reviews mcr
where mcr.market_id = m.id
  and m.is_public is true;

update public.markets m
set public_feed_allowed = coalesce(pmc.public_feed_allowed, false),
    sensitivity_tier = coalesce(pmc.sensitivity_tier, 'standard'),
    compliance_review_state = case
      when coalesce(pmc.sensitivity_tier, 'standard') = 'prohibited' then 'rejected'
      when coalesce(pmc.requires_manual_review, false) then 'pending'
      else 'approved'
    end,
    market_category = coalesce(pmc.category, m.market_category, 'general_event')
from public.prohibited_market_categories pmc
where m.is_public is true
  and not exists (select 1 from public.market_compliance_reviews mcr where mcr.market_id = m.id)
  and lower(regexp_replace(coalesce(m.category, 'general_event'), '[^a-z0-9]+', '_', 'g')) = pmc.category;

-- Default uncategorized public markets to general_event approved
update public.markets m
set public_feed_allowed = true,
    compliance_review_state = 'approved',
    sensitivity_tier = 'standard',
    market_category = 'general_event'
where m.is_public is true
  and m.public_feed_allowed is not true
  and coalesce(m.category, 'general_event') in ('Tech', 'Entertainment', 'general_event')
  and not exists (
    select 1 from public.prohibited_market_categories pmc
    where pmc.category = 'sports'
      and lower(regexp_replace(coalesce(m.category, ''), '[^a-z0-9]+', '_', 'g')) = 'sports'
  );

-- Sports-like public markets: hide from feed
update public.markets
set public_feed_allowed = false,
    compliance_review_state = 'pending',
    sensitivity_tier = 'restricted',
    market_category = 'sports'
where is_public is true
  and lower(regexp_replace(coalesce(category, ''), '[^a-z0-9]+', '_', 'g')) = 'sports';

commit;
