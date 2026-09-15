-- Group admin console: acknowledgments, settlement ratings, reopen governance, disputes scope

begin;

-- ============================================================================
-- Markets: settlement override / challenged state
-- ============================================================================

alter table public.markets
  add column if not exists settlement_override_status text not null default 'none'
    check (settlement_override_status in ('none', 'frozen', 'voided', 'corrected', 'challenged'));

-- ============================================================================
-- Group admin acknowledgment
-- ============================================================================

create table if not exists public.group_admin_acknowledgments (
  user_id uuid primary key references public.users(id) on delete cascade,
  policy_version_hash text not null,
  jurisdiction text not null,
  locale text not null default 'en',
  accepted_at timestamptz not null default now()
);

alter table public.group_admin_acknowledgments enable row level security;

drop policy if exists "Users read own group admin ack" on public.group_admin_acknowledgments;
create policy "Users read own group admin ack"
  on public.group_admin_acknowledgments for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.has_group_admin_acknowledgment()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_admin_acknowledgments
    where user_id = auth.uid()
  );
$$;

create or replace function public.accept_group_admin_acknowledgment()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_jurisdiction text := 'US';
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(ucp.jurisdiction, 'US') into v_jurisdiction
  from public.user_compliance_profiles ucp
  where ucp.user_id = v_user_id;

  insert into public.group_admin_acknowledgments (user_id, policy_version_hash, jurisdiction, locale)
  values (v_user_id, '2026-07-01-group-settlements', v_jurisdiction, coalesce(public.get_user_policy_locale(v_user_id), 'en'))
  on conflict (user_id) do update
    set policy_version_hash = excluded.policy_version_hash,
        accepted_at = now();
end;
$$;

-- ============================================================================
-- Settlement ratings
-- ============================================================================

create table if not exists public.group_admin_settlement_ratings (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  admin_id uuid not null references public.users(id) on delete cascade,
  rater_id uuid not null references public.users(id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  fairness text not null check (fairness in ('fair', 'unclear', 'unfair')),
  comment text,
  created_at timestamptz not null default now(),
  unique (market_id, rater_id)
);

create index if not exists idx_settlement_ratings_market on public.group_admin_settlement_ratings(market_id);
create index if not exists idx_settlement_ratings_group on public.group_admin_settlement_ratings(group_id);

alter table public.group_admin_settlement_ratings enable row level security;

drop policy if exists "Bettors insert own ratings" on public.group_admin_settlement_ratings;
create policy "Bettors insert own ratings"
  on public.group_admin_settlement_ratings for insert to authenticated
  with check (rater_id = (select auth.uid()));

drop policy if exists "Group members read ratings" on public.group_admin_settlement_ratings;
create policy "Group members read ratings"
  on public.group_admin_settlement_ratings for select to authenticated
  using (public.is_group_member(group_id, (select auth.uid())));

create table if not exists public.settlement_rating_flags (
  id uuid primary key default gen_random_uuid(),
  rating_id uuid not null references public.group_admin_settlement_ratings(id) on delete cascade,
  flag_type text not null,
  weight_multiplier numeric not null default 0.25,
  created_at timestamptz not null default now()
);

create table if not exists public.settlement_reopen_evaluations (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  n_decisive integer not null default 0,
  p_hat numeric not null default 0,
  wilson_lower numeric not null default 0,
  threshold_used numeric not null default 0.7,
  bayesian_posterior_unfair numeric not null default 0,
  collusion_excluded_count integer not null default 0,
  decision text not null default 'none',
  evaluated_at timestamptz not null default now()
);

create index if not exists idx_reopen_eval_market on public.settlement_reopen_evaluations(market_id, evaluated_at desc);

create table if not exists public.settlement_reopen_config (
  key text primary key,
  value numeric not null,
  description text
);

insert into public.settlement_reopen_config (key, value, description) values
  ('base_unfair_threshold', 0.70, 'Mature-group unfair proportion target'),
  ('participation_min', 0.40, 'Min share of bettors rating'),
  ('bayesian_reopen_probability', 0.95, 'Posterior P(unfair>0.7) threshold'),
  ('grace_hours_play', 24, 'Play mode grace hours'),
  ('grace_hours_live', 48, 'Live mode grace hours'),
  ('rating_window_days', 7, 'Days to collect ratings')
on conflict (key) do nothing;

-- ============================================================================
-- close_market
-- ============================================================================

create or replace function public.close_market(p_market_id uuid)
returns public.markets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_market public.markets;
  v_is_admin boolean := false;
  v_is_creator boolean := false;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_market from public.markets where id = p_market_id;
  if v_market.id is null then
    raise exception 'Market not found';
  end if;
  if v_market.status <> 'open' then
    raise exception 'Market is not open';
  end if;
  if v_market.group_id is null then
    raise exception 'Not a group market';
  end if;

  select (role = 'admin') into v_is_admin
  from public.group_members
  where group_id = v_market.group_id and user_id = v_user_id;

  v_is_creator := v_market.creator_id = v_user_id;

  if not (v_is_admin or v_is_creator) then
    raise exception 'Not authorized to close this market';
  end if;

  update public.markets
  set status = 'closed'
  where id = p_market_id
  returning * into v_market;

  return v_market;
end;
$$;

-- ============================================================================
-- submit_admin_settlement_rating
-- ============================================================================

create or replace function public.submit_admin_settlement_rating(
  p_market_id uuid,
  p_score smallint,
  p_fairness text,
  p_comment text default null
)
returns public.group_admin_settlement_ratings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_market public.markets;
  v_admin_id uuid;
  v_rating public.group_admin_settlement_ratings;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_market from public.markets where id = p_market_id;
  if v_market.id is null or v_market.status <> 'resolved' then
    raise exception 'Market must be resolved to rate';
  end if;
  if v_market.group_id is null then
    raise exception 'Not a group market';
  end if;

  if not exists (
    select 1 from public.bets b
    where b.market_id = p_market_id and b.user_id = v_user_id
  ) then
    raise exception 'Only bettors may rate settlements';
  end if;

  select g.admin_id into v_admin_id from public.groups g where g.id = v_market.group_id;

  insert into public.group_admin_settlement_ratings (
    market_id, group_id, admin_id, rater_id, score, fairness, comment
  ) values (
    p_market_id, v_market.group_id, v_admin_id, v_user_id, p_score, p_fairness, p_comment
  )
  on conflict (market_id, rater_id) do update
    set score = excluded.score,
        fairness = excluded.fairness,
        comment = excluded.comment
  returning * into v_rating;

  perform public.evaluate_settlement_reopen(p_market_id);

  return v_rating;
end;
$$;

-- ============================================================================
-- get_group_admin_trust_score
-- ============================================================================

create or replace function public.get_group_admin_trust_score(
  p_group_id uuid,
  p_admin_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'avg_score', (select avg(score)::numeric from public.group_admin_settlement_ratings r where r.group_id = p_group_id and r.admin_id = p_admin_id),
    'rating_count', (select count(*)::int from public.group_admin_settlement_ratings r where r.group_id = p_group_id and r.admin_id = p_admin_id),
    'unfair_rate', (
      select case when count(*) = 0 then null
        else (count(*) filter (where fairness = 'unfair'))::numeric / count(*)::numeric
      end
      from public.group_admin_settlement_ratings r
      where r.group_id = p_group_id and r.admin_id = p_admin_id
    )
  );
$$;

-- ============================================================================
-- evaluate_settlement_reopen (simplified SQL mirror of TS evaluator)
-- ============================================================================

create or replace function public.evaluate_settlement_reopen(p_market_id uuid)
returns public.settlement_reopen_evaluations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market public.markets;
  v_eligible int;
  v_down int;
  v_up int;
  v_n int;
  v_n_min int;
  v_participation numeric;
  v_p_hat numeric;
  v_threshold numeric := 0.70;
  v_wilson_lower numeric;
  v_z numeric := 1.96;
  v_z2 numeric;
  v_decision text := 'none';
  v_eval public.settlement_reopen_evaluations;
begin
  select * into v_market from public.markets where id = p_market_id;
  if v_market.id is null or v_market.status <> 'resolved' then
    return null;
  end if;

  select count(distinct user_id) into v_eligible
  from public.bets where market_id = p_market_id;

  select
    count(*) filter (where fairness = 'unfair' or score <= 2),
    count(*) filter (where fairness = 'fair' or score >= 4)
  into v_down, v_up
  from public.group_admin_settlement_ratings
  where market_id = p_market_id;

  v_n := coalesce(v_down, 0) + coalesce(v_up, 0);
  v_n_min := greatest(3, ceil(sqrt(greatest(v_eligible, 1)::numeric))::int);
  v_participation := case when v_eligible > 0 then v_n::numeric / v_eligible else 0 end;
  v_p_hat := case when v_n > 0 then v_down::numeric / v_n else 0 end;
  v_threshold := 0.70 - 0.15 * exp(-v_n::numeric / 10);

  if v_n > 0 then
    v_z2 := v_z * v_z;
    v_wilson_lower := (
      v_p_hat + v_z2 / (2 * v_n) -
      v_z * sqrt((v_p_hat * (1 - v_p_hat) + v_z2 / (4 * v_n)) / v_n)
    ) / (1 + v_z2 / v_n);
  else
    v_wilson_lower := 0;
  end if;

  if v_n >= v_n_min and v_participation >= 0.40 and v_wilson_lower > v_threshold then
    v_decision := 'reopen_candidate';
    update public.markets
    set settlement_override_status = 'challenged'
    where id = p_market_id and settlement_override_status = 'none';
  elsif v_n >= v_n_min and v_participation >= 0.40 and v_wilson_lower > v_threshold * 0.85 then
    v_decision := 'review';
  end if;

  insert into public.settlement_reopen_evaluations (
    market_id, n_decisive, p_hat, wilson_lower, threshold_used,
    bayesian_posterior_unfair, collusion_excluded_count, decision
  ) values (
    p_market_id, v_n, v_p_hat, v_wilson_lower, v_threshold,
    0, 0, v_decision
  )
  returning * into v_eval;

  return v_eval;
end;
$$;

-- ============================================================================
-- resolve_dispute: allow group admin OR platform admin
-- ============================================================================

create or replace function public.resolve_dispute(
    p_dispute_id uuid,
    p_status text,
    p_admin_response text default null
)
returns public.disputes
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_user_id uuid := auth.uid();
    v_is_app_admin boolean;
    v_dispute public.disputes;
    v_market public.markets;
    v_is_group_admin boolean := false;
begin
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;

    select is_admin into v_is_app_admin from public.users where id = v_user_id;

    select * into v_dispute from public.disputes where id = p_dispute_id;
    if v_dispute.id is null then
        raise exception 'Dispute not found';
    end if;

    select * into v_market from public.markets where id = v_dispute.market_id;

    if v_market.group_id is not null then
      select (role = 'admin') into v_is_group_admin
      from public.group_members
      where group_id = v_market.group_id and user_id = v_user_id;
    end if;

    if v_is_app_admin is not true and v_is_group_admin is not true then
        raise exception 'Not authorized to resolve disputes';
    end if;

    if p_status not in ('upheld', 'overturned', 'dismissed') then
        raise exception 'Invalid dispute status';
    end if;

    update public.disputes
    set status = p_status,
        admin_response = p_admin_response,
        resolved_by = v_user_id,
        resolved_at = now()
    where id = p_dispute_id
    returning * into v_dispute;

    return v_dispute;
end;
$function$;

-- ============================================================================
-- get_group_admin_disputes / get_group_admin_markets
-- ============================================================================

create or replace function public.get_group_admin_disputes(
  p_group_id uuid,
  p_status text default 'pending'
)
returns setof public.disputes
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_group_admin(p_group_id, auth.uid())
     and not public.is_app_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  return query
  select d.*
  from public.disputes d
  join public.markets m on m.id = d.market_id
  where m.group_id = p_group_id
    and (p_status is null or d.status = p_status)
  order by d.created_at asc;
end;
$$;

create or replace function public.get_group_admin_markets(
  p_group_id uuid,
  p_status text default null
)
returns setof public.markets
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_group_admin(p_group_id, auth.uid())
     and not public.is_app_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  return query
  select m.*
  from public.markets m
  where m.group_id = p_group_id
    and (p_status is null or m.status::text = p_status)
  order by m.created_at desc;
end;
$$;

-- ============================================================================
-- report_admin_misconduct
-- ============================================================================

create or replace function public.report_admin_misconduct(
  p_group_id uuid,
  p_admin_id uuid,
  p_market_id uuid default null,
  p_severity text default 'report',
  p_reason text default '',
  p_details text default null,
  p_evidence_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_report_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_group_member(p_group_id, v_user_id) then
    raise exception 'Not a group member';
  end if;

  insert into public.content_reports (
    reporter_id, target_type, target_id, target_user_id, reason, details, status
  ) values (
    v_user_id,
    'group_admin_misconduct',
    coalesce(p_market_id, p_group_id),
    p_admin_id,
    p_reason,
    coalesce(p_details, '') || coalesce(' evidence: ' || p_evidence_url, ''),
    'open'
  )
  returning id into v_report_id;

  if p_severity = 'urgent' then
    perform public.record_compliance_event(
      p_user_id := p_admin_id,
      p_event_type := 'admin_misconduct_report',
      p_action := 'urgent_escalation',
      p_decision := 'pending',
      p_reason_code := p_reason,
      p_metadata := jsonb_build_object(
        'group_id', p_group_id,
        'market_id', p_market_id,
        'reporter_id', v_user_id,
        'evidence_url', p_evidence_url
      )
    );
  end if;

  return v_report_id;
end;
$$;

-- ============================================================================
-- get_groups_administered (include promoted admins + stats)
-- ============================================================================
-- Postgres forbids changing RETURNS TABLE / OUT row type via CREATE OR REPLACE
-- (42P13). Prior shape (20260629130000) omitted pending_dispute_count,
-- avg_admin_score, and platform_override_active — drop before recreate.
drop function if exists public.get_groups_administered();

create or replace function public.get_groups_administered()
returns table (
  group_id uuid,
  name text,
  description text,
  avatar_url text,
  member_count bigint,
  active_market_count bigint,
  pending_dispute_count bigint,
  avg_admin_score numeric,
  platform_override_active boolean,
  is_discoverable boolean,
  show_on_profile boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    g.id as group_id,
    g.name,
    g.description,
    g.avatar_url,
    (select count(*) from public.group_members gm where gm.group_id = g.id) as member_count,
    (
      select count(*)
      from public.markets m
      where m.group_id = g.id and m.status = 'open'
    ) as active_market_count,
    (
      select count(*)
      from public.disputes d
      join public.markets m on m.id = d.market_id
      where m.group_id = g.id and d.status = 'pending'
    ) as pending_dispute_count,
    (
      select avg(r.score)::numeric
      from public.group_admin_settlement_ratings r
      where r.group_id = g.id and r.admin_id = g.admin_id
    ) as avg_admin_score,
    exists (
      select 1 from public.markets m
      where m.group_id = g.id
        and m.settlement_override_status in ('frozen', 'challenged', 'voided')
    ) as platform_override_active,
    g.is_discoverable,
    g.show_on_profile,
    g.created_at
  from public.groups g
  where coalesce(g.is_dm, false) = false
    and (
      g.admin_id = v_user_id
      or exists (
        select 1 from public.group_members gm
        where gm.group_id = g.id and gm.user_id = v_user_id and gm.role = 'admin'
      )
    )
  order by g.created_at desc;
end;
$function$;

grant execute on function public.has_group_admin_acknowledgment() to authenticated;
grant execute on function public.accept_group_admin_acknowledgment() to authenticated;
grant execute on function public.close_market(uuid) to authenticated;
grant execute on function public.submit_admin_settlement_rating(uuid, smallint, text, text) to authenticated;
grant execute on function public.get_group_admin_trust_score(uuid, uuid) to authenticated;
grant execute on function public.evaluate_settlement_reopen(uuid) to authenticated;
grant execute on function public.get_group_admin_disputes(uuid, text) to authenticated;
grant execute on function public.get_group_admin_markets(uuid, text) to authenticated;
grant execute on function public.report_admin_misconduct(uuid, uuid, uuid, text, text, text, text) to authenticated;
grant execute on function public.get_groups_administered() to authenticated;

commit;
