begin;

-- ============================================================================
-- EC sports content detection (question/description/options text scan)
-- ============================================================================

create or replace function public.detect_sports_market_content(
  p_question text default null,
  p_description text default null,
  p_options text[] default null,
  p_resolution_source text default null,
  p_category text default null
)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_blob text;
  v_match text;
  v_matches text[] := array[]::text[];
  v_patterns text[] := array[
    '\m(sports?|sporting|sportbook|sportsbook)\M',
    '\m(futbol|fútbol|football|soccer|baloncesto|basketball|beisbol|béisbol|baseball)\M',
    '\m(nba|nfl|mlb|nhl|mls|uefa|fifa|ncaa)\M',
    '(premier[\s_]+league|la[\s_]+liga|champions[\s_]+league|world[\s_]+cup|copa[\s_]+america|copa[\s_]+del[\s_]+rey)',
    '(super[\s_]+bowl|playoffs?|final[\s_]+match|match[\s_]+day)',
    '\m(gol|goles|marcador|penalti|partido|encuentro|torneo|campeonato)\M',
    '\m(barcelona|real[\s_]+madrid|manchester|liverpool|chelsea|arsenal|bayern|psg)\M',
    '\m(quarterback|touchdown|home[\s_]+run|hat[\s_]+trick|mvp)\M',
    '\mvs\.?\M',
    '(will|who)[[:space:]].+[[:space:]]+(win|beat|defeat|score)',
    '\m(ganar|gana|vencer|vence|anotar)\M'
  ];
begin
  if public.is_sports_market_category(p_category) then
    return jsonb_build_object(
      'blocked', true,
      'reason_code', 'ec_sports_market_blocked',
      'matches', jsonb_build_array(coalesce(nullif(trim(p_category), ''), 'sports'))
    );
  end if;

  v_blob := lower(concat_ws(
    ' ',
    coalesce(p_question, ''),
    coalesce(p_description, ''),
    coalesce(p_resolution_source, ''),
    coalesce(array_to_string(p_options, ' '), '')
  ));

  if nullif(trim(v_blob), '') is null then
    return jsonb_build_object('blocked', false, 'reason_code', null, 'matches', '[]'::jsonb);
  end if;

  foreach v_match in array v_patterns loop
    if v_blob ~* v_match then
      v_matches := array_append(v_matches, v_match);
    end if;
  end loop;

  if coalesce(array_length(v_matches, 1), 0) > 0 then
    return jsonb_build_object(
      'blocked', true,
      'reason_code', 'ec_sports_content_detected',
      'matches', to_jsonb(v_matches)
    );
  end if;

  return jsonb_build_object('blocked', false, 'reason_code', null, 'matches', '[]'::jsonb);
end;
$$;

create or replace function public.market_option_labels(p_market_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(o.label order by o.created_at), array[]::text[])
  from public.options o
  where o.market_id = p_market_id;
$$;

create or replace function public.ec_sports_market_blocked_for_user(
  p_user_id uuid,
  p_market_id uuid default null,
  p_category text default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_jurisdiction text;
  v_rules public.compliance_jurisdiction_rules;
  v_market public.markets;
  v_review public.market_compliance_reviews;
  v_category text;
  v_scan jsonb;
begin
  if p_user_id is null then
    return false;
  end if;

  v_jurisdiction := public.get_user_compliance_jurisdiction(p_user_id);
  if v_jurisdiction <> 'EC' then
    return false;
  end if;

  select * into v_rules
  from public.compliance_jurisdiction_rules
  where jurisdiction = 'EC';

  if coalesce(v_rules.public_sports_markets_allowed, false) is true then
    return false;
  end if;

  if p_market_id is not null then
    select * into v_market from public.markets where id = p_market_id;
    select * into v_review from public.market_compliance_reviews where market_id = p_market_id;
  end if;

  v_category := coalesce(
    nullif(trim(p_category), ''),
    v_review.category,
    v_market.market_category,
    v_market.category,
    'general_event'
  );

  if public.is_sports_market_category(v_category) then
    return true;
  end if;

  if v_market.id is not null then
    v_scan := public.detect_sports_market_content(
      v_market.question,
      v_market.description,
      public.market_option_labels(v_market.id),
      coalesce(v_review.resolution_source, v_market.resolution_source),
      v_category
    );
    return coalesce((v_scan->>'blocked')::boolean, false);
  end if;

  return false;
end;
$$;

create or replace function public.assert_compliance_gate(
  p_user_id uuid,
  p_action text,
  p_market_id uuid default null,
  p_amount numeric default null,
  p_provider text default null,
  p_crypto_asset text default null,
  p_crypto_network text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.user_compliance_profiles;
  v_market public.markets;
  v_review public.market_compliance_reviews;
  v_rules public.compliance_jurisdiction_rules;
  v_has_policies boolean;
  v_provider_key text := case
    when p_provider in ('stripe_identity', 'stripe_connect') then 'stripe'
    else p_provider
  end;
  v_reason text;
  v_scan jsonb;
begin
  if p_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  insert into public.user_compliance_profiles (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_profile
  from public.user_compliance_profiles
  where user_id = p_user_id;

  select * into v_rules
  from public.compliance_jurisdiction_rules
  where jurisdiction = v_profile.jurisdiction;

  v_has_policies := public.has_current_policy_acceptances(p_user_id);
  if v_has_policies is not true then
    v_reason := 'missing_current_policy_acceptance';
  elsif v_profile.risk_tier in ('restricted', 'prohibited')
      or v_profile.review_status in ('rejected', 'frozen')
      or v_profile.restricted_at is not null then
    v_reason := 'user_restricted';
  elsif p_action not in ('browse', 'sandbox') and v_profile.kyc_status <> 'verified' then
    v_reason := 'kyc_not_verified';
  elsif p_action in ('stripe_deposit', 'withdrawal', 'transfer', 'live_position', 'moonpay_onramp', 'moonpay_offramp')
      and v_profile.live_wallet_enabled is not true then
    v_reason := 'live_wallet_not_enabled';
  elsif p_action in ('moonpay_onramp', 'moonpay_offramp')
      and v_profile.crypto_rails_enabled is not true then
    v_reason := 'crypto_rails_not_enabled';
  elsif p_provider is not null
      and v_rules.allowed_payment_providers is not null
      and not (v_provider_key = any (v_rules.allowed_payment_providers)) then
    v_reason := 'provider_not_allowed';
  elsif p_crypto_asset is not null
      and v_rules.allowed_crypto_assets is not null
      and not (upper(p_crypto_asset) = any (v_rules.allowed_crypto_assets)) then
    v_reason := 'crypto_asset_not_allowed';
  end if;

  if p_market_id is not null then
    select * into v_market
    from public.markets
    where id = p_market_id;

    select * into v_review
    from public.market_compliance_reviews
    where market_id = p_market_id;

    if v_market.id is null then
      v_reason := coalesce(v_reason, 'market_not_found');
    elsif coalesce(v_review.review_state, v_market.compliance_review_state, 'approved') not in ('approved') then
      v_reason := coalesce(v_reason, 'market_not_approved');
    elsif coalesce(v_review.sensitivity_tier, v_market.sensitivity_tier, 'standard') = 'prohibited' then
      v_reason := coalesce(v_reason, 'market_prohibited');
    elsif public.ec_sports_market_blocked_for_user(
      p_user_id,
      p_market_id,
      coalesce(v_review.category, v_market.market_category, v_market.category)
    ) then
      v_scan := public.detect_sports_market_content(
        v_market.question,
        v_market.description,
        public.market_option_labels(v_market.id),
        coalesce(v_review.resolution_source, v_market.resolution_source),
        coalesce(v_review.category, v_market.market_category, v_market.category)
      );
      v_reason := coalesce(v_reason, v_scan->>'reason_code', 'ec_sports_market_blocked');
    end if;
  end if;

  if v_reason is not null then
    perform public.record_compliance_event(
      p_user_id,
      'wallet_gate_decision',
      p_action,
      'denied',
      v_reason,
      jsonb_build_object(
        'amount', p_amount,
        'provider', p_provider,
        'crypto_asset', p_crypto_asset,
        'crypto_network', p_crypto_network,
        'jurisdiction', v_profile.jurisdiction
      ),
      p_provider,
      null,
      p_market_id
    );
    raise exception 'Compliance gate denied: %', v_reason using errcode = '42501';
  end if;

  perform public.record_compliance_event(
    p_user_id,
    'wallet_gate_decision',
    p_action,
    'approved',
    null,
    jsonb_build_object(
      'amount', p_amount,
      'provider', p_provider,
      'crypto_asset', p_crypto_asset,
      'crypto_network', p_crypto_network,
      'jurisdiction', v_profile.jurisdiction
    ),
    p_provider,
    null,
    p_market_id
  );

  return jsonb_build_object(
    'allowed', true,
    'action', p_action,
    'jurisdiction', v_profile.jurisdiction,
    'kyc_status', v_profile.kyc_status
  );
end;
$$;

create or replace function public.upsert_market_compliance_review(
  p_market_id uuid,
  p_category text,
  p_resolution_source text,
  p_creator_attestation boolean default false,
  p_resolver_type text default 'creator_source',
  p_metadata jsonb default '{}'::jsonb
)
returns public.market_compliance_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_market public.markets;
  v_rule public.prohibited_market_categories;
  v_category text := public.normalize_market_category(coalesce(nullif(trim(p_category), ''), 'general_event'));
  v_review public.market_compliance_reviews;
  v_creator_jurisdiction text;
  v_ec_sports_blocked boolean := false;
  v_scan jsonb;
  v_reason_code text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_market
  from public.markets
  where id = p_market_id;

  if v_market.id is null then
    raise exception 'Market not found';
  end if;

  if v_market.creator_id <> v_user_id and public.is_app_admin(v_user_id) is not true then
    raise exception 'Not authorized';
  end if;

  v_creator_jurisdiction := public.get_user_compliance_jurisdiction(v_market.creator_id);

  if v_creator_jurisdiction = 'EC' then
    v_scan := public.detect_sports_market_content(
      v_market.question,
      v_market.description,
      public.market_option_labels(v_market.id),
      coalesce(p_resolution_source, v_market.resolution_source),
      v_category
    );
    v_ec_sports_blocked := coalesce((v_scan->>'blocked')::boolean, false);
    v_reason_code := v_scan->>'reason_code';
  end if;

  if v_ec_sports_blocked and public.is_app_admin(v_user_id) is not true then
    perform public.record_compliance_event(
      v_market.creator_id,
      'market_review_state_changed',
      'create_market',
      'denied',
      coalesce(v_reason_code, 'ec_sports_content_detected'),
      jsonb_build_object(
        'category', v_category,
        'jurisdiction', v_creator_jurisdiction,
        'matches', coalesce(v_scan->'matches', '[]'::jsonb)
      ),
      null,
      null,
      p_market_id
    );
    raise exception 'Sports markets and sports-related content are not permitted for Ecuador users'
      using errcode = '42501', hint = coalesce(v_reason_code, 'ec_sports_content_detected');
  end if;

  select * into v_rule
  from public.prohibited_market_categories
  where category = v_category;

  if v_rule.category is null then
    select * into v_rule
    from public.prohibited_market_categories
    where category = 'general_event';
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
    metadata
  ) values (
    p_market_id,
    v_market.creator_id,
    coalesce(v_rule.category, v_category),
    case
      when v_ec_sports_blocked then 'restricted'
      else coalesce(v_rule.sensitivity_tier, 'standard')
    end,
    case
      when v_ec_sports_blocked then 'rejected'
      when coalesce(v_rule.sensitivity_tier, 'standard') = 'prohibited' then 'rejected'
      when coalesce(v_rule.requires_manual_review, false) then 'pending'
      else 'approved'
    end,
    case
      when v_ec_sports_blocked then false
      else coalesce(v_rule.public_feed_allowed, false)
    end,
    p_resolution_source,
    p_resolver_type,
    p_creator_attestation,
    case
      when v_ec_sports_blocked then coalesce(v_reason_code, 'ec_sports_content_detected')
      else coalesce(v_rule.category, v_category)
    end,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'sports_scan', coalesce(v_scan, '{}'::jsonb)
    )
  )
  on conflict (market_id) do update
    set category = excluded.category,
        sensitivity_tier = excluded.sensitivity_tier,
        review_state = excluded.review_state,
        public_feed_allowed = excluded.public_feed_allowed,
        resolution_source = excluded.resolution_source,
        resolver_type = excluded.resolver_type,
        creator_attestation = excluded.creator_attestation,
        reason_code = excluded.reason_code,
        metadata = excluded.metadata,
        updated_at = now()
  returning * into v_review;

  update public.markets
    set market_category = v_review.category,
        sensitivity_tier = v_review.sensitivity_tier,
        resolution_source = v_review.resolution_source,
        resolver_type = v_review.resolver_type,
        compliance_review_state = v_review.review_state,
        public_feed_allowed = v_review.public_feed_allowed,
        updated_at = now()
  where id = p_market_id;

  perform public.record_compliance_event(
    v_market.creator_id,
    'market_review_state_changed',
    'create_market',
    v_review.review_state,
    v_review.reason_code,
    jsonb_build_object('category', v_review.category, 'sensitivity_tier', v_review.sensitivity_tier),
    null,
    null,
    p_market_id
  );

  return v_review;
end;
$$;

-- Backfill: flag public markets with sports content
update public.markets m
set public_feed_allowed = false,
    compliance_review_state = 'rejected',
    sensitivity_tier = 'restricted',
    market_category = coalesce(m.market_category, 'sports')
where m.is_public is true
  and (public.detect_sports_market_content(
    m.question,
    m.description,
    public.market_option_labels(m.id),
    m.resolution_source,
    m.market_category
  )->>'blocked')::boolean is true;

grant execute on function public.detect_sports_market_content(text, text, text[], text, text) to authenticated, service_role;
grant execute on function public.market_option_labels(uuid) to authenticated, service_role;

commit;
