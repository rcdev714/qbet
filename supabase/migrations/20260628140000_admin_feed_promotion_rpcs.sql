begin;

-- Platform admins bypass user compliance gates when seeding public feed markets.
create or replace function public.insert_market_options(
  p_market_id uuid,
  p_labels text[]
)
returns setof public.options
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_market public.markets;
  v_label text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_market
  from public.markets
  where id = p_market_id;

  if v_market.id is null then
    raise exception 'Market not found' using errcode = 'P0002';
  end if;

  if v_market.creator_id <> v_user_id then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if v_market.group_id is not null
      and public.is_group_member(v_market.group_id, v_user_id) is not true then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if v_market.group_id is null and coalesce(v_market.is_public, false) is true then
    if public.is_app_admin(v_user_id) is not true then
      raise exception 'Forbidden' using errcode = '42501';
    end if;
  end if;

  if p_labels is null
      or array_length(p_labels, 1) is null
      or array_length(p_labels, 1) < 2 then
    raise exception 'At least two options required' using errcode = '22023';
  end if;

  foreach v_label in array p_labels loop
    if btrim(coalesce(v_label, '')) = '' then
      raise exception 'Option labels cannot be empty' using errcode = '22023';
    end if;
  end loop;

  if exists (select 1 from public.options o where o.market_id = p_market_id) then
    raise exception 'Options already exist for this market' using errcode = '23505';
  end if;

  if public.is_app_admin(v_user_id) is not true then
    perform public.assert_compliance_gate(v_user_id, 'create_market', p_market_id);
  end if;

  return query
  insert into public.options (market_id, label, total_pool)
  select p_market_id, btrim(lbl), 0
  from unnest(p_labels) as lbl
  returning *;
end;
$$;

-- Promote / approve a market onto the public feed with admin authority.
create or replace function public.admin_promote_market_to_feed(p_market_id uuid)
returns public.markets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_market public.markets;
  v_scan jsonb;
  v_category text;
begin
  if v_admin is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if public.is_app_admin(v_admin) is not true then
    raise exception 'Admin only' using errcode = '42501';
  end if;

  select * into v_market
  from public.markets
  where id = p_market_id;

  if v_market.id is null then
    raise exception 'Market not found' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.options o where o.market_id = p_market_id) then
    raise exception 'Market has no options' using errcode = '22023';
  end if;

  v_category := coalesce(
    nullif(trim(v_market.market_category), ''),
    nullif(trim(v_market.category), ''),
    'general_event'
  );

  v_scan := public.detect_sports_market_content(
    v_market.question,
    v_market.description,
    public.market_option_labels(p_market_id),
    v_market.resolution_source,
    v_category
  );

  if coalesce((v_scan->>'blocked')::boolean, false) is true then
    raise exception 'Sports markets cannot be promoted to the public feed'
      using errcode = '42501', hint = coalesce(v_scan->>'reason_code', 'ec_sports_content_detected');
  end if;

  insert into public.market_compliance_reviews (
    market_id,
    creator_id,
    category,
    sensitivity_tier,
    review_state,
    public_feed_allowed,
    resolution_source,
    resolver_type,
    creator_attestation,
    reason_code,
    metadata,
    reviewer_id,
    reviewed_at
  ) values (
    p_market_id,
    v_market.creator_id,
    public.normalize_market_category(v_category),
    coalesce(v_market.sensitivity_tier, 'standard'),
    'approved',
    true,
    coalesce(v_market.resolution_source, 'Admin-promoted to public feed'),
    coalesce(v_market.resolver_type, 'creator_source'),
    true,
    'admin_feed_promotion',
    jsonb_build_object('promoted_by', v_admin, 'sports_scan', coalesce(v_scan, '{}'::jsonb)),
    v_admin,
    now()
  )
  on conflict (market_id) do update
    set review_state = 'approved',
        public_feed_allowed = true,
        reviewer_id = v_admin,
        reviewed_at = now(),
        reason_code = 'admin_feed_promotion',
        metadata = coalesce(public.market_compliance_reviews.metadata, '{}'::jsonb)
          || jsonb_build_object('promoted_by', v_admin, 'promoted_at', now()),
        updated_at = now();

  update public.markets
  set is_public = true,
      featured_at = coalesce(featured_at, now()),
      compliance_review_state = 'approved',
      public_feed_allowed = true,
      market_category = public.normalize_market_category(v_category),
      updated_at = now()
  where id = p_market_id
  returning * into v_market;

  perform public.record_compliance_event(
    v_market.creator_id,
    'market_review_state_changed',
    'create_market',
    'approved',
    'admin_feed_promotion',
    jsonb_build_object('promoted_by', v_admin, 'market_id', p_market_id),
    null,
    v_admin,
    p_market_id
  );

  return v_market;
end;
$$;

create or replace function public.admin_approve_market_for_feed(p_market_id uuid)
returns public.markets
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.admin_promote_market_to_feed(p_market_id);
end;
$$;

revoke all on function public.admin_promote_market_to_feed(uuid) from public, anon;
revoke all on function public.admin_approve_market_for_feed(uuid) from public, anon;
grant execute on function public.admin_promote_market_to_feed(uuid) to authenticated, service_role;
grant execute on function public.admin_approve_market_for_feed(uuid) to authenticated, service_role;

commit;
