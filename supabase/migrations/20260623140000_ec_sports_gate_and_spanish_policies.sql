begin;

-- ============================================================================
-- Ecuador licensing compliance: server-side sports blocks + Spanish EC policies
-- ============================================================================

create or replace function public.normalize_market_category(p_category text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      lower(regexp_replace(coalesce(nullif(trim(p_category), ''), 'general_event'), '[^a-z0-9]+', '_', 'g')),
      ''
    ),
    'general_event'
  );
$$;

create or replace function public.is_sports_market_category(p_category text)
returns boolean
language sql
immutable
as $$
  with normalized as (
    select public.normalize_market_category(p_category) as value
  )
  select
    value = 'sports'
    or value like '%\_sports%' escape '\'
    or value like 'sports\_%' escape '\'
    or value like '%\_sport%' escape '\'
    or value like '%sport\_%' escape '\'
    or value ~ '(^|_)(futbol|fútbol|soccer|nba|nfl|mlb|liga|champions|world_cup|copa|deportivo|deportivos|partido)(_|$)'
  from normalized;
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

  return public.is_sports_market_category(v_category);
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
      v_reason := coalesce(v_reason, 'ec_sports_market_blocked');
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
  v_ec_sports_blocked := v_creator_jurisdiction = 'EC'
    and public.is_sports_market_category(v_category);

  if v_ec_sports_blocked and public.is_app_admin(v_user_id) is not true then
    perform public.record_compliance_event(
      v_market.creator_id,
      'market_review_state_changed',
      'create_market',
      'denied',
      'ec_sports_market_blocked',
      jsonb_build_object('category', v_category, 'jurisdiction', v_creator_jurisdiction),
      null,
      null,
      p_market_id
    );
    raise exception 'Sports markets are not permitted for Ecuador users'
      using errcode = '42501', hint = 'ec_sports_market_blocked';
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
      when v_ec_sports_blocked then 'ec_sports_market_blocked'
      else coalesce(v_rule.category, v_category)
    end,
    coalesce(p_metadata, '{}'::jsonb)
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

-- Spanish-primary EC policy pack (lib/legal/policy-content-es-ec.ts)
update public.policy_versions
set retired_at = now()
where jurisdiction = 'EC'
  and is_required is true
  and retired_at is null
  and version <> '2026-06-22-es-ec';

insert into public.policy_versions(kind, version, title, url, content_hash, is_required, effective_at, jurisdiction)
values
  ('terms', '2026-06-22-es-ec', 'Términos de Servicio', '/terms', '9a32fc5d2c559ff867db6763b631f2e8947d52f7b7d8c0860805f5b5fdd8efe4', true, now(), 'EC'),
  ('privacy', '2026-06-22-es-ec', 'Política de Privacidad', '/privacy', 'eb6621f9af34f77627f28b758eefe0596169895704516663a68829270f29dc64', true, now(), 'EC'),
  ('risk_disclosure', '2026-06-22-es-ec', 'Divulgación de Riesgos de Mercados con Dinero Real', '/risk', '453d607cab4005d282bdeb4c4d55557698a07d789727578e1564def1b5573c89', true, now(), 'EC'),
  ('market_rules', '2026-06-22-es-ec', 'Reglas de Creación y Resolución de Mercados', '/market-rules', 'b204b28e8eddd9f51ce6825a701701f918617825d3c8375a0f06ce5d25da910c', true, now(), 'EC'),
  ('aml_kyc', '2026-06-22-es-ec', 'Política AML y KYC', '/aml-kyc', '53b9f2f2d4a2b6903d0550fd2e3b4d4715720ab96400f3f76a8a830276cfddbd', true, now(), 'EC'),
  ('prohibited_markets', '2026-06-22-es-ec', 'Política de Mercados Prohibidos', '/prohibited-markets', '542f578f346cd165763dcab7034448ab069c7d4bc8d712f97cd9165804cecd51', true, now(), 'EC')
on conflict (kind, version, jurisdiction) do update
  set title = excluded.title,
      url = excluded.url,
      content_hash = excluded.content_hash,
      is_required = excluded.is_required,
      effective_at = excluded.effective_at,
      retired_at = null;

grant execute on function public.normalize_market_category(text) to authenticated, service_role;
grant execute on function public.is_sports_market_category(text) to authenticated, service_role;
grant execute on function public.ec_sports_market_blocked_for_user(uuid, uuid, text) to authenticated, service_role;

commit;
