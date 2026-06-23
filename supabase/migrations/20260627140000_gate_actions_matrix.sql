begin;

-- ============================================================================
-- Phase 3: Gate actions matrix
-- Table-driven compliance gate requirements + age attestation for live actions.
-- ============================================================================

create table if not exists public.gate_actions (
  action text primary key,
  requires_policy_pack boolean not null default false,
  requires_age_attestation boolean not null default false,
  requires_kyc boolean not null default false,
  requires_live_wallet boolean not null default false,
  requires_crypto_rails boolean not null default false,
  requires_market_approval boolean not null default false,
  allows_restricted_user boolean not null default false,
  description text
);

insert into public.gate_actions (
  action,
  requires_policy_pack,
  requires_age_attestation,
  requires_kyc,
  requires_live_wallet,
  requires_crypto_rails,
  requires_market_approval,
  allows_restricted_user,
  description
)
values
  (
    'browse',
    false, false, false, false, false, false, true,
    'Read-only market browsing.'
  ),
  (
    'sandbox',
    false, false, false, false, false, false, true,
    'Practice mode interactions without real money.'
  ),
  (
    'create_market',
    true, true, false, false, false, false, true,
    'Create a user-generated market in a private group.'
  ),
  (
    'live_position',
    true, true, true, true, false, true, false,
    'Place a live wallet bet on an approved market.'
  ),
  (
    'stripe_deposit',
    true, true, true, true, false, false, false,
    'Deposit funds via Stripe.'
  ),
  (
    'withdrawal',
    true, true, true, true, false, false, false,
    'Withdraw live wallet funds.'
  ),
  (
    'transfer',
    true, true, true, true, false, false, false,
    'Peer wallet transfer between verified users.'
  ),
  (
    'moonpay_onramp',
    true, true, true, true, true, false, false,
    'Crypto on-ramp via MoonPay.'
  ),
  (
    'moonpay_offramp',
    true, true, true, true, true, false, false,
    'Crypto off-ramp via MoonPay.'
  ),
  (
    'resolve_market',
    true, false, false, false, false, false, true,
    'Resolve a market as group admin or creator.'
  )
on conflict (action) do update
  set requires_policy_pack = excluded.requires_policy_pack,
      requires_age_attestation = excluded.requires_age_attestation,
      requires_kyc = excluded.requires_kyc,
      requires_live_wallet = excluded.requires_live_wallet,
      requires_crypto_rails = excluded.requires_crypto_rails,
      requires_market_approval = excluded.requires_market_approval,
      allows_restricted_user = excluded.allows_restricted_user,
      description = excluded.description;

alter table public.gate_actions enable row level security;

drop policy if exists "Gate actions readable" on public.gate_actions;
create policy "Gate actions readable"
  on public.gate_actions
  for select
  to authenticated
  using (true);

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
    'approved', true,
    'action', p_action,
    'jurisdiction', v_profile.jurisdiction
  );
end;
$$;

grant execute on function public.assert_compliance_gate(uuid, text, uuid, numeric, text, text, text) to authenticated, service_role;

commit;
