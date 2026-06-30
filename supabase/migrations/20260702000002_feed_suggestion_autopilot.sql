begin;

alter table public.feed_market_suggestions
  add column if not exists evidence_sources jsonb not null default '[]'::jsonb,
  add column if not exists resolution_source_url text,
  add column if not exists resolution_criteria text,
  add column if not exists event_start_at timestamptz,
  add column if not exists expected_resolution_at timestamptz,
  add column if not exists close_date_reason text,
  add column if not exists resolution_date_source_url text,
  add column if not exists source_quality_score int not null default 0,
  add column if not exists source_count int not null default 0,
  add column if not exists has_official_source boolean not null default false,
  add column if not exists engagement_score int not null default 0,
  add column if not exists resolution_quality_score int not null default 0,
  add column if not exists compliance_risk_score int not null default 100,
  add column if not exists duplicate_score int not null default 0,
  add column if not exists autopilot_score int not null default 0,
  add column if not exists autopilot_status text not null default 'needs_review',
  add column if not exists autopilot_reasons jsonb not null default '[]'::jsonb,
  add column if not exists admin_feedback_reason text,
  add column if not exists admin_edit_snapshot jsonb,
  add column if not exists market_engagement_snapshot jsonb;

alter table public.feed_market_suggestions
  drop constraint if exists feed_market_suggestions_autopilot_status_check,
  add constraint feed_market_suggestions_autopilot_status_check
    check (autopilot_status in ('needs_review', 'eligible', 'auto_created', 'blocked'));

alter table public.feed_market_suggestions
  drop constraint if exists feed_market_suggestions_score_ranges_check,
  add constraint feed_market_suggestions_score_ranges_check
    check (
      source_quality_score between 0 and 100
      and engagement_score between 0 and 100
      and resolution_quality_score between 0 and 100
      and compliance_risk_score between 0 and 100
      and duplicate_score between 0 and 100
      and autopilot_score between 0 and 100
      and source_count >= 0
    );

create index if not exists idx_feed_market_suggestions_autopilot_status
  on public.feed_market_suggestions (autopilot_status, autopilot_score desc, created_at desc);

create index if not exists idx_feed_market_suggestions_created_market_id
  on public.feed_market_suggestions (created_market_id)
  where created_market_id is not null;

-- Admin feedback when a suggestion is dismissed.
create or replace function public.admin_dismiss_feed_suggestion(
  p_id uuid,
  p_feedback_reason text default null
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

  update public.feed_market_suggestions
  set
    status = 'dismissed',
    autopilot_status = case
      when autopilot_status = 'auto_created' then autopilot_status
      else 'blocked'
    end,
    reviewed_by = v_admin,
    reviewed_at = now(),
    admin_feedback_reason = nullif(btrim(p_feedback_reason), '')
  where id = p_id
    and status = 'pending'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Suggestion not found or not pending' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

-- Backward-compatible wrapper for older clients/tests.
create or replace function public.admin_dismiss_feed_suggestion(p_id uuid)
returns public.feed_market_suggestions
language sql
security definer
set search_path = public
as $$
  select public.admin_dismiss_feed_suggestion(p_id, null);
$$;

-- Admin link suggestion to created market, preserving edit/audit context.
create or replace function public.admin_mark_suggestion_created(
  p_id uuid,
  p_market_id uuid,
  p_admin_edit_snapshot jsonb default null
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
    autopilot_status = case
      when autopilot_status = 'eligible' then 'auto_created'
      else autopilot_status
    end,
    created_market_id = p_market_id,
    reviewed_by = v_admin,
    reviewed_at = now(),
    admin_edit_snapshot = p_admin_edit_snapshot
  where id = p_id
    and status = 'pending'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Suggestion not found or not pending' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

-- Backward-compatible wrapper for older clients/tests.
create or replace function public.admin_mark_suggestion_created(
  p_id uuid,
  p_market_id uuid
)
returns public.feed_market_suggestions
language sql
security definer
set search_path = public
as $$
  select public.admin_mark_suggestion_created(p_id, p_market_id, null);
$$;

grant execute on function public.admin_dismiss_feed_suggestion(uuid, text) to authenticated;
grant execute on function public.admin_dismiss_feed_suggestion(uuid) to authenticated;
grant execute on function public.admin_mark_suggestion_created(uuid, uuid, jsonb) to authenticated;
grant execute on function public.admin_mark_suggestion_created(uuid, uuid) to authenticated;

create or replace function public.autopilot_create_feed_market_from_suggestion(
  p_suggestion_id uuid
)
returns public.markets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_suggestion public.feed_market_suggestions;
  v_creator_id uuid;
  v_market public.markets;
  v_labels text[];
  v_label text;
begin
  select * into v_suggestion
  from public.feed_market_suggestions
  where id = p_suggestion_id
  for update;

  if v_suggestion.id is null then
    raise exception 'Suggestion not found' using errcode = 'P0002';
  end if;

  if v_suggestion.status <> 'pending' or v_suggestion.autopilot_status <> 'eligible' then
    raise exception 'Suggestion is not autopilot eligible' using errcode = '22023';
  end if;

  if v_suggestion.created_market_id is not null then
    raise exception 'Suggestion already created a market' using errcode = '23505';
  end if;

  select id into v_creator_id
  from public.users
  where is_admin is true
  order by created_at
  limit 1;

  if v_creator_id is null then
    raise exception 'No admin user available for autopilot market creator' using errcode = 'P0002';
  end if;

  select array_agg(value::text) into v_labels
  from jsonb_array_elements_text(v_suggestion.options) as value;

  if v_labels is null or array_length(v_labels, 1) < 2 then
    raise exception 'At least two options required' using errcode = '22023';
  end if;

  foreach v_label in array v_labels loop
    if btrim(coalesce(v_label, '')) = '' then
      raise exception 'Option labels cannot be empty' using errcode = '22023';
    end if;
  end loop;

  insert into public.markets (
    group_id,
    creator_id,
    question,
    description,
    closes_at,
    status,
    is_public,
    featured_at,
    category,
    market_type,
    compliance_review_state
  ) values (
    null,
    v_creator_id,
    btrim(v_suggestion.question),
    nullif(btrim(coalesce(v_suggestion.description, v_suggestion.rationale, '')), ''),
    v_suggestion.suggested_closes_at,
    'open'::public.market_status,
    true,
    now(),
    v_suggestion.category,
    case when array_length(v_labels, 1) = 2 then 'binary' else 'multi_option' end,
    'pending'
  )
  returning * into v_market;

  insert into public.options (market_id, label, total_pool)
  select v_market.id, btrim(lbl), 0
  from unnest(v_labels) as lbl;

  perform public.upsert_market_compliance_review(
    v_market.id,
    'general_event',
    coalesce(
      nullif(btrim(v_suggestion.resolution_source_url), ''),
      nullif(btrim(v_suggestion.resolution_date_source_url), ''),
      nullif(btrim(v_suggestion.description), ''),
      'Autopilot suggestion source'
    ),
    true,
    'creator_source',
    jsonb_build_object(
      'feed_category', v_suggestion.category,
      'feed_suggestion_id', v_suggestion.id,
      'autopilot_score', v_suggestion.autopilot_score,
      'resolution_criteria', v_suggestion.resolution_criteria,
      'evidence_sources', v_suggestion.evidence_sources
    )
  );

  update public.feed_market_suggestions
  set
    status = 'created',
    autopilot_status = 'auto_created',
    created_market_id = v_market.id,
    reviewed_at = now()
  where id = v_suggestion.id;

  select * into v_market
  from public.markets
  where id = v_market.id;

  return v_market;
end;
$$;

revoke all on function public.autopilot_create_feed_market_from_suggestion(uuid) from public;
grant execute on function public.autopilot_create_feed_market_from_suggestion(uuid) to service_role;

commit;
