begin;

-- New markets should not default to approved before review exists.
alter table public.markets
  alter column compliance_review_state set default 'pending';

-- Orphan markets (no review row) that still carry the legacy approved default.
update public.markets m
set compliance_review_state = 'pending'
where not exists (
  select 1
  from public.market_compliance_reviews mcr
  where mcr.market_id = m.id
)
and coalesce(m.compliance_review_state, 'approved') = 'approved';

-- Missing review state must not pass approval-gated actions.
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
  v_gate public.gate_actions;
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

  select * into v_gate
  from public.gate_actions ga
  where ga.action = p_action;

  if v_gate.action is null then
    v_reason := 'unknown_gate_action';
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

  if v_gate.action is not null then
    if v_gate.requires_policy_pack then
      v_has_policies := public.has_current_policy_acceptances(p_user_id);
      if v_has_policies is not true then
        v_reason := coalesce(v_reason, 'missing_current_policy_acceptance');
      end if;
    end if;

    if v_gate.requires_age_attestation
      and coalesce(v_profile.age_attested_at, null) is null
      and v_profile.age_verified is not true then
      v_reason := coalesce(v_reason, 'age_not_attested');
    end if;

    if not v_gate.allows_restricted_user then
      if v_profile.risk_tier in ('restricted', 'prohibited')
          or v_profile.review_status in ('rejected', 'frozen')
          or v_profile.restricted_at is not null then
        v_reason := coalesce(v_reason, 'user_restricted');
      end if;
    end if;

    if v_gate.requires_kyc and v_profile.kyc_status <> 'verified' then
      v_reason := coalesce(v_reason, 'kyc_not_verified');
    end if;

    if v_gate.requires_live_wallet and v_profile.live_wallet_enabled is not true then
      v_reason := coalesce(v_reason, 'live_wallet_not_enabled');
    end if;

    if v_gate.requires_crypto_rails and v_profile.crypto_rails_enabled is not true then
      v_reason := coalesce(v_reason, 'crypto_rails_not_enabled');
    end if;
  end if;

  if p_provider is not null
      and v_rules.allowed_payment_providers is not null
      and not (v_provider_key = any (v_rules.allowed_payment_providers)) then
    v_reason := coalesce(v_reason, 'provider_not_allowed');
  end if;

  if p_crypto_asset is not null
      and v_rules.allowed_crypto_assets is not null
      and not (upper(p_crypto_asset) = any (v_rules.allowed_crypto_assets)) then
    v_reason := coalesce(v_reason, 'crypto_asset_not_allowed');
  end if;

  if p_market_id is not null and coalesce(v_gate.requires_market_approval, false) then
    select * into v_market
    from public.markets
    where id = p_market_id;

    select * into v_review
    from public.market_compliance_reviews
    where market_id = p_market_id;

    if v_market.id is null then
      v_reason := coalesce(v_reason, 'market_not_found');
    elsif coalesce(v_review.review_state, v_market.compliance_review_state, 'pending') not in ('approved') then
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
    'approved', true,
    'action', p_action,
    'jurisdiction', v_profile.jurisdiction
  );
end;
$$;

-- Atomic market creation: market + options + compliance review in one transaction.
create or replace function public.create_market_with_options(
  p_question text,
  p_labels text[],
  p_group_id uuid default null,
  p_description text default null,
  p_closes_at timestamptz default null,
  p_image_url text default null,
  p_status public.market_status default 'open',
  p_is_public boolean default false,
  p_featured_at timestamptz default null,
  p_category text default null,
  p_market_type text default 'binary',
  p_compliance_category text default 'general_event',
  p_resolution_source text default null,
  p_creator_attestation boolean default true,
  p_resolver_type text default 'creator_source',
  p_metadata jsonb default '{}'::jsonb
)
returns public.markets
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

  if btrim(coalesce(p_question, '')) = '' then
    raise exception 'Question is required' using errcode = '22023';
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

  if coalesce(p_is_public, false) is true then
    if public.is_app_admin(v_user_id) is not true then
      raise exception 'Forbidden' using errcode = '42501';
    end if;
    if p_group_id is not null then
      raise exception 'Public markets cannot belong to a group' using errcode = '22023';
    end if;
  elsif p_group_id is null then
    raise exception 'Group id required for private markets' using errcode = '22023';
  elsif public.is_group_member(p_group_id, v_user_id) is not true then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  insert into public.markets (
    group_id,
    creator_id,
    question,
    description,
    closes_at,
    status,
    image_url,
    is_public,
    featured_at,
    category,
    market_type,
    compliance_review_state
  ) values (
    p_group_id,
    v_user_id,
    btrim(p_question),
    nullif(btrim(coalesce(p_description, '')), ''),
    p_closes_at,
    coalesce(p_status, 'open'::public.market_status),
    nullif(btrim(coalesce(p_image_url, '')), ''),
    coalesce(p_is_public, false),
    p_featured_at,
    nullif(btrim(coalesce(p_category, '')), ''),
    coalesce(nullif(btrim(coalesce(p_market_type, '')), ''), 'binary'),
    'pending'
  )
  returning * into v_market;

  perform public.assert_compliance_gate(v_user_id, 'create_market', v_market.id);

  insert into public.options (market_id, label, total_pool)
  select v_market.id, btrim(lbl), 0
  from unnest(p_labels) as lbl;

  perform public.upsert_market_compliance_review(
    v_market.id,
    coalesce(nullif(btrim(p_compliance_category), ''), 'general_event'),
    coalesce(
      nullif(btrim(coalesce(p_resolution_source, '')), ''),
      nullif(btrim(coalesce(p_description, '')), ''),
      'Creator-declared source at market creation'
    ),
    coalesce(p_creator_attestation, true),
    coalesce(nullif(btrim(coalesce(p_resolver_type, '')), ''), 'creator_source'),
    coalesce(p_metadata, '{}'::jsonb)
  );

  select * into v_market
  from public.markets
  where id = v_market.id;

  return v_market;
end;
$$;

revoke all on function public.create_market_with_options(
  text,
  text[],
  uuid,
  text,
  timestamptz,
  text,
  public.market_status,
  boolean,
  timestamptz,
  text,
  text,
  text,
  text,
  boolean,
  text,
  jsonb
) from public, anon;

grant execute on function public.create_market_with_options(
  text,
  text[],
  uuid,
  text,
  timestamptz,
  text,
  public.market_status,
  boolean,
  timestamptz,
  text,
  text,
  text,
  text,
  boolean,
  text,
  jsonb
) to authenticated, service_role;

grant execute on function public.assert_compliance_gate(uuid, text, uuid, numeric, text, text, text) to authenticated, service_role;

commit;
