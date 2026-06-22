begin;
-- ============================================================================
-- Compliance taxonomy and provider-neutral persistence.
-- This migration is intentionally additive so it can run against existing data.
-- ============================================================================

create table if not exists public.policy_versions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('terms', 'privacy', 'risk_disclosure', 'market_rules', 'aml_kyc', 'prohibited_markets')),
  version text not null,
  title text not null,
  url text,
  content_hash text not null,
  is_required boolean not null default true,
  effective_at timestamptz not null default now(),
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  unique (kind, version)
);
create table if not exists public.user_policy_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  policy_version_id uuid not null references public.policy_versions(id),
  accepted_at timestamptz not null default now(),
  ip_hash text,
  user_agent text,
  app_version text,
  locale text,
  source text not null default 'signup',
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, policy_version_id)
);
create table if not exists public.user_compliance_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  kyc_provider text not null default 'manual' check (kyc_provider in ('manual', 'stripe_identity', 'stripe_connect', 'moonpay', 'sumsub', 'persona')),
  kyc_status text not null default 'not_started' check (kyc_status in ('not_started', 'pending', 'verified', 'requires_review', 'rejected', 'expired', 'provider_restricted', 'manual_review')),
  jurisdiction text not null default 'EC',
  age_verified boolean not null default false,
  live_wallet_enabled boolean not null default false,
  crypto_rails_enabled boolean not null default false,
  risk_tier text not null default 'standard' check (risk_tier in ('standard', 'elevated', 'restricted', 'prohibited')),
  review_status text not null default 'not_started' check (review_status in ('not_started', 'pending', 'approved', 'rejected', 'frozen')),
  restricted_at timestamptz,
  restriction_reason text,
  verified_at timestamptz,
  last_reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.kyc_verification_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('stripe_identity', 'stripe_connect', 'moonpay', 'sumsub', 'persona', 'manual')),
  provider_session_id text not null,
  provider_customer_id text,
  provider_report_id text,
  status text not null default 'pending' check (status in ('not_started', 'pending', 'verified', 'requires_review', 'rejected', 'expired', 'provider_restricted', 'manual_review')),
  verification_level text not null default 'standard',
  country text,
  expires_at timestamptz,
  completed_at timestamptz,
  last_webhook_event_id text,
  retry_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_session_id)
);
create table if not exists public.payment_provider_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'moonpay', 'btc_payout')),
  provider_account_type text not null,
  provider_account_id text not null,
  status text not null default 'active',
  country text,
  currency text,
  capabilities jsonb not null default '{}'::jsonb,
  restrictions jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_account_type, provider_account_id)
);
create table if not exists public.crypto_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null default 'moonpay' check (provider in ('moonpay', 'btc_payout')),
  direction text not null check (direction in ('onramp', 'offramp')),
  provider_transaction_id text not null,
  status text not null default 'pending',
  fiat_currency text not null default 'USD',
  fiat_amount numeric,
  crypto_asset text,
  crypto_amount numeric,
  network text,
  wallet_address text,
  refund_wallet_address text,
  transaction_hash text,
  provider_fee numeric,
  platform_fee numeric,
  credited_transaction_id uuid references public.transactions(id),
  reserved_transaction_id uuid references public.transactions(id),
  settled_at timestamptz,
  raw_status text,
  last_webhook_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_transaction_id)
);
alter table public.payment_provider_accounts
  drop constraint if exists payment_provider_accounts_provider_check;
alter table public.payment_provider_accounts
  add constraint payment_provider_accounts_provider_check
  check (provider in ('stripe', 'moonpay', 'btc_payout'));
alter table public.crypto_transactions
  drop constraint if exists crypto_transactions_provider_check;
alter table public.crypto_transactions
  add constraint crypto_transactions_provider_check
  check (provider in ('moonpay', 'btc_payout'));
create table if not exists public.market_compliance_reviews (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  creator_id uuid references public.users(id),
  category text not null default 'general_event',
  sensitivity_tier text not null default 'standard' check (sensitivity_tier in ('standard', 'restricted', 'prohibited')),
  review_state text not null default 'approved' check (review_state in ('draft', 'pending', 'approved', 'rejected', 'frozen')),
  public_feed_allowed boolean not null default false,
  resolution_source text,
  resolver_type text not null default 'creator_source',
  evidence_requirements text,
  creator_attestation boolean not null default false,
  reviewer_id uuid references public.users(id),
  reviewed_at timestamptz,
  reason_code text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (market_id)
);
create table if not exists public.compliance_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  actor_id uuid references public.users(id) on delete set null,
  market_id uuid references public.markets(id) on delete set null,
  event_type text not null,
  provider text,
  provider_event_id text,
  subject_type text,
  subject_id text,
  action text,
  decision text,
  reason_code text,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists compliance_events_provider_event_unique
  on public.compliance_events(provider, provider_event_id)
  where provider is not null and provider_event_id is not null;
create table if not exists public.accounting_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  market_id uuid references public.markets(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  crypto_transaction_id uuid references public.crypto_transactions(id) on delete set null,
  entry_type text not null,
  direction text not null check (direction in ('debit', 'credit')),
  amount numeric not null,
  currency text not null default 'USD',
  provider text,
  provider_reference_id text,
  tax_period text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.regulatory_report_periods (
  id uuid primary key default gen_random_uuid(),
  jurisdiction text not null default 'EC',
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft', 'prepared', 'submitted', 'amended')),
  totals jsonb not null default '{}'::jsonb,
  prepared_by uuid references public.users(id),
  prepared_at timestamptz,
  submitted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (jurisdiction, period_start, period_end)
);
create table if not exists public.compliance_jurisdiction_rules (
  jurisdiction text primary key,
  public_sports_markets_allowed boolean not null default false,
  real_money_requires_kyc boolean not null default true,
  crypto_rails_requires_provider_kyc boolean not null default true,
  tax_and_aml_export_required boolean not null default true,
  allowed_payment_providers text[] not null default array['stripe', 'moonpay', 'btc_payout'],
  allowed_crypto_assets text[] not null default array['USDC', 'USDT', 'ETH', 'BTC'],
  notes text,
  updated_at timestamptz not null default now()
);
insert into public.compliance_jurisdiction_rules (
  jurisdiction,
  public_sports_markets_allowed,
  real_money_requires_kyc,
  crypto_rails_requires_provider_kyc,
  tax_and_aml_export_required,
  allowed_payment_providers,
  allowed_crypto_assets,
  notes
) values (
  'EC',
  false,
  true,
  true,
  true,
  array['stripe', 'moonpay', 'btc_payout'],
  array['USDC', 'USDT', 'ETH', 'BTC'],
  'Ecuador launch posture: no public sports feed, progressive KYC, ledger exports, and manual review for sensitive categories.'
) on conflict (jurisdiction) do update
  set public_sports_markets_allowed = excluded.public_sports_markets_allowed,
      real_money_requires_kyc = excluded.real_money_requires_kyc,
      crypto_rails_requires_provider_kyc = excluded.crypto_rails_requires_provider_kyc,
      tax_and_aml_export_required = excluded.tax_and_aml_export_required,
      allowed_payment_providers = excluded.allowed_payment_providers,
      allowed_crypto_assets = excluded.allowed_crypto_assets,
      notes = excluded.notes,
      updated_at = now();
create table if not exists public.prohibited_market_categories (
  category text primary key,
  sensitivity_tier text not null check (sensitivity_tier in ('standard', 'restricted', 'prohibited')),
  public_feed_allowed boolean not null default false,
  requires_manual_review boolean not null default true,
  reason text not null,
  updated_at timestamptz not null default now()
);
insert into public.prohibited_market_categories(category, sensitivity_tier, public_feed_allowed, requires_manual_review, reason)
values
  ('general_event', 'standard', true, false, 'Standard future event with objective resolution source.'),
  ('finance', 'restricted', false, true, 'Finance-adjacent markets need review for investment-contract and consumer-risk concerns.'),
  ('politics', 'restricted', false, true, 'Political markets can trigger election, manipulation, and public-order concerns.'),
  ('sports', 'restricted', false, true, 'Sports markets are excluded from the public feed during Ecuador framework development.'),
  ('individual_health', 'prohibited', false, true, 'Markets on individual health or personal safety are prohibited.'),
  ('violence_or_death', 'prohibited', false, true, 'Markets that incentivize or speculate on harm, violence, or death are prohibited.'),
  ('national_security', 'prohibited', false, true, 'National security and conflict markets require legal review before availability.')
on conflict (category) do update
  set sensitivity_tier = excluded.sensitivity_tier,
      public_feed_allowed = excluded.public_feed_allowed,
      requires_manual_review = excluded.requires_manual_review,
      reason = excluded.reason,
      updated_at = now();
insert into public.policy_versions(kind, version, title, url, content_hash, is_required, effective_at)
values
  ('terms', '2026-05-14', 'Terms of Service', '/terms', 'pending-legal-hash-terms-2026-05-14', true, now()),
  ('privacy', '2026-05-14', 'Privacy Policy', '/privacy', 'pending-legal-hash-privacy-2026-05-14', true, now()),
  ('risk_disclosure', '2026-05-14', 'Real-Money Market Risk Disclosure', '/risk', 'pending-legal-hash-risk-2026-05-14', true, now()),
  ('market_rules', '2026-05-14', 'Market Creation and Resolution Rules', '/market-rules', 'pending-legal-hash-market-rules-2026-05-14', true, now()),
  ('aml_kyc', '2026-05-14', 'AML and KYC Policy', '/aml-kyc', 'pending-legal-hash-aml-kyc-2026-05-14', true, now()),
  ('prohibited_markets', '2026-05-14', 'Prohibited Markets Policy', '/prohibited-markets', 'pending-legal-hash-prohibited-markets-2026-05-14', true, now())
on conflict (kind, version) do nothing;
alter table public.markets
  add column if not exists market_category text default 'general_event',
  add column if not exists sensitivity_tier text default 'standard',
  add column if not exists resolution_source text,
  add column if not exists resolver_type text default 'creator_source',
  add column if not exists compliance_review_state text default 'approved',
  add column if not exists public_feed_allowed boolean default false;
alter table public.crypto_transactions
  add column if not exists credited_transaction_id uuid references public.transactions(id),
  add column if not exists reserved_transaction_id uuid references public.transactions(id),
  add column if not exists settled_at timestamptz;
alter table public.transactions
  drop constraint if exists transactions_type_check;
alter table public.transactions
  add constraint transactions_type_check
  check (
    type = any (
      array[
        'deposit',
        'withdrawal',
        'bet_placed',
        'bet_won',
        'bet_refund',
        'bet_lost',
        'play_credit_refresh',
        'transfer_sent',
        'transfer_received',
        'crypto_onramp',
        'crypto_offramp',
        'provider_fee',
        'protocol_fee',
        'tax_withholding'
      ]
    )
  );
create or replace function public.is_app_admin(p_user_id uuid)
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
      and u.is_admin is true
  );
$$;
create or replace function public.has_current_policy_acceptances(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with required_policies as (
    select distinct on (pv.kind) pv.id, pv.kind
    from public.policy_versions pv
    where pv.is_required is true
      and pv.retired_at is null
      and pv.effective_at <= now()
    order by pv.kind, pv.effective_at desc, pv.created_at desc
  )
  select not exists (
    select 1
    from required_policies rp
    where not exists (
      select 1
      from public.user_policy_acceptances upa
      where upa.user_id = p_user_id
        and upa.policy_version_id = rp.id
    )
  );
$$;
create or replace function public.record_compliance_event(
  p_user_id uuid,
  p_event_type text,
  p_action text default null,
  p_decision text default null,
  p_reason_code text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_provider text default null,
  p_provider_event_id text default null,
  p_market_id uuid default null,
  p_actor_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  insert into public.compliance_events (
    user_id,
    actor_id,
    market_id,
    event_type,
    provider,
    provider_event_id,
    action,
    decision,
    reason_code,
    metadata
  ) values (
    p_user_id,
    coalesce(p_actor_id, auth.uid()),
    p_market_id,
    p_event_type,
    p_provider,
    p_provider_event_id,
    p_action,
    p_decision,
    p_reason_code,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (provider, provider_event_id) where provider is not null and provider_event_id is not null
  do update set metadata = public.compliance_events.metadata || excluded.metadata
  returning id into v_event_id;

  return v_event_id;
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
  v_category text := lower(regexp_replace(coalesce(nullif(trim(p_category), ''), 'general_event'), '[^a-z0-9]+', '_', 'g'));
  v_review public.market_compliance_reviews;
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
    coalesce(v_rule.sensitivity_tier, 'standard'),
    case
      when coalesce(v_rule.sensitivity_tier, 'standard') = 'prohibited' then 'rejected'
      when coalesce(v_rule.requires_manual_review, false) then 'pending'
      else 'approved'
    end,
    coalesce(v_rule.public_feed_allowed, false),
    p_resolution_source,
    p_resolver_type,
    p_creator_attestation,
    coalesce(v_rule.category, v_category),
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
create or replace function public.upsert_provider_compliance_status(
  p_user_id uuid,
  p_provider text,
  p_provider_session_id text,
  p_status text,
  p_provider_customer_id text default null,
  p_provider_report_id text default null,
  p_provider_event_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.kyc_verification_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.kyc_verification_sessions;
  v_normalized_status text := coalesce(p_status, 'pending');
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  insert into public.user_compliance_profiles(user_id, kyc_provider)
  values (p_user_id, p_provider)
  on conflict (user_id) do nothing;

  insert into public.kyc_verification_sessions (
    user_id,
    provider,
    provider_session_id,
    provider_customer_id,
    provider_report_id,
    status,
    last_webhook_event_id,
    completed_at,
    metadata
  ) values (
    p_user_id,
    p_provider,
    p_provider_session_id,
    p_provider_customer_id,
    p_provider_report_id,
    v_normalized_status,
    p_provider_event_id,
    case when v_normalized_status = 'verified' then now() else null end,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (provider, provider_session_id) do update
    set status = excluded.status,
        provider_customer_id = coalesce(excluded.provider_customer_id, public.kyc_verification_sessions.provider_customer_id),
        provider_report_id = coalesce(excluded.provider_report_id, public.kyc_verification_sessions.provider_report_id),
        last_webhook_event_id = excluded.last_webhook_event_id,
        completed_at = coalesce(excluded.completed_at, public.kyc_verification_sessions.completed_at),
        metadata = public.kyc_verification_sessions.metadata || excluded.metadata,
        updated_at = now()
  returning * into v_session;

  update public.user_compliance_profiles
    set kyc_provider = p_provider,
        kyc_status = v_normalized_status,
        age_verified = case when v_normalized_status = 'verified' then true else age_verified end,
        live_wallet_enabled = case when v_normalized_status = 'verified' then true else live_wallet_enabled end,
        crypto_rails_enabled = case when v_normalized_status = 'verified' then true else crypto_rails_enabled end,
        verified_at = case when v_normalized_status = 'verified' then coalesce(verified_at, now()) else verified_at end,
        review_status = case
          when v_normalized_status = 'verified' then 'approved'
          when v_normalized_status in ('requires_review', 'manual_review') then 'pending'
          when v_normalized_status in ('rejected', 'provider_restricted') then 'rejected'
          else review_status
        end,
        updated_at = now()
  where user_id = p_user_id;

  perform public.record_compliance_event(
    p_user_id,
    'kyc_status_changed',
    'provider_update',
    v_normalized_status,
    null,
    coalesce(p_metadata, '{}'::jsonb),
    p_provider,
    p_provider_event_id,
    null
  );

  return v_session;
end;
$$;
create or replace function public.upsert_crypto_transaction(
  p_user_id uuid,
  p_direction text,
  p_provider_transaction_id text,
  p_status text,
  p_fiat_currency text default 'USD',
  p_fiat_amount numeric default null,
  p_crypto_asset text default null,
  p_crypto_amount numeric default null,
  p_network text default null,
  p_wallet_address text default null,
  p_refund_wallet_address text default null,
  p_transaction_hash text default null,
  p_provider_fee numeric default null,
  p_provider_event_id text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_provider text default 'moonpay'
)
returns public.crypto_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx public.crypto_transactions;
begin
  insert into public.crypto_transactions (
    provider,
    user_id,
    direction,
    provider_transaction_id,
    status,
    raw_status,
    fiat_currency,
    fiat_amount,
    crypto_asset,
    crypto_amount,
    network,
    wallet_address,
    refund_wallet_address,
    transaction_hash,
    provider_fee,
    last_webhook_event_id,
    metadata
  ) values (
    p_provider,
    p_user_id,
    p_direction,
    p_provider_transaction_id,
    p_status,
    p_status,
    p_fiat_currency,
    p_fiat_amount,
    p_crypto_asset,
    p_crypto_amount,
    p_network,
    p_wallet_address,
    p_refund_wallet_address,
    p_transaction_hash,
    p_provider_fee,
    p_provider_event_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (provider, provider_transaction_id) do update
    set status = excluded.status,
        raw_status = excluded.raw_status,
        fiat_amount = coalesce(excluded.fiat_amount, public.crypto_transactions.fiat_amount),
        crypto_amount = coalesce(excluded.crypto_amount, public.crypto_transactions.crypto_amount),
        crypto_asset = coalesce(excluded.crypto_asset, public.crypto_transactions.crypto_asset),
        network = coalesce(excluded.network, public.crypto_transactions.network),
        wallet_address = coalesce(excluded.wallet_address, public.crypto_transactions.wallet_address),
        refund_wallet_address = coalesce(excluded.refund_wallet_address, public.crypto_transactions.refund_wallet_address),
        transaction_hash = coalesce(excluded.transaction_hash, public.crypto_transactions.transaction_hash),
        provider_fee = coalesce(excluded.provider_fee, public.crypto_transactions.provider_fee),
        last_webhook_event_id = excluded.last_webhook_event_id,
        metadata = public.crypto_transactions.metadata || excluded.metadata,
        updated_at = now()
  returning * into v_tx;

  perform public.record_compliance_event(
    p_user_id,
    'crypto_transaction_status_changed',
    p_direction,
    p_status,
    null,
    coalesce(p_metadata, '{}'::jsonb),
    p_provider,
    p_provider_event_id,
    null
  );

  return v_tx;
end;
$$;
create or replace function public.apply_crypto_onramp_credit(
  p_provider text,
  p_provider_transaction_id text,
  p_provider_event_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_crypto public.crypto_transactions;
  v_transaction_id uuid;
  v_reference_id text;
  v_status text;
begin
  select * into v_crypto
  from public.crypto_transactions
  where provider = p_provider
    and provider_transaction_id = p_provider_transaction_id
  for update;

  if v_crypto.id is null then
    raise exception 'Crypto transaction not found';
  end if;

  if v_crypto.direction <> 'onramp' then
    raise exception 'Crypto transaction is not an onramp';
  end if;

  if coalesce(v_crypto.fiat_amount, 0) <= 0 then
    raise exception 'Crypto onramp missing fiat amount';
  end if;

  if v_crypto.credited_transaction_id is not null then
    return v_crypto.credited_transaction_id;
  end if;

  v_status := lower(coalesce(v_crypto.status, ''));
  if v_status not in ('completed', 'complete', 'succeeded', 'success', 'approved') then
    return null;
  end if;

  v_reference_id := p_provider || ':' || p_provider_transaction_id;

  insert into public.wallets (user_id, balance, is_virtual, currency)
  values (v_crypto.user_id, 0, false, coalesce(v_crypto.fiat_currency, 'USD'))
  on conflict (user_id) do nothing;

  insert into public.transactions (
    user_id,
    amount,
    type,
    status,
    reference_id,
    is_play_mode,
    metadata
  ) values (
    v_crypto.user_id,
    v_crypto.fiat_amount,
    'deposit',
    'completed',
    v_reference_id,
    false,
    jsonb_build_object(
      'provider', p_provider,
      'rail', 'crypto_onramp',
      'crypto_transaction_id', v_crypto.id,
      'provider_transaction_id', p_provider_transaction_id,
      'provider_event_id', p_provider_event_id,
      'crypto_asset', v_crypto.crypto_asset,
      'crypto_amount', v_crypto.crypto_amount,
      'transaction_hash', v_crypto.transaction_hash
    ) || coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (reference_id, type) where reference_id is not null do nothing
  returning id into v_transaction_id;

  if v_transaction_id is not null then
    update public.wallets
      set balance = balance + v_crypto.fiat_amount,
          total_deposited = coalesce(total_deposited, 0) + v_crypto.fiat_amount,
          is_virtual = false,
          updated_at = now()
    where user_id = v_crypto.user_id;

    insert into public.accounting_ledger_entries (
      user_id,
      transaction_id,
      crypto_transaction_id,
      entry_type,
      direction,
      amount,
      currency,
      provider,
      provider_reference_id,
      metadata
    ) values (
      v_crypto.user_id,
      v_transaction_id,
      v_crypto.id,
      'wallet_deposit',
      'credit',
      v_crypto.fiat_amount,
      coalesce(v_crypto.fiat_currency, 'USD'),
      p_provider,
      p_provider_transaction_id,
      coalesce(p_metadata, '{}'::jsonb)
    );
  else
    select id into v_transaction_id
    from public.transactions
    where reference_id = v_reference_id
      and type = 'deposit'
    limit 1;
  end if;

  update public.crypto_transactions
    set credited_transaction_id = coalesce(credited_transaction_id, v_transaction_id),
        settled_at = coalesce(settled_at, now()),
        last_webhook_event_id = coalesce(p_provider_event_id, last_webhook_event_id),
        metadata = metadata || coalesce(p_metadata, '{}'::jsonb),
        updated_at = now()
  where id = v_crypto.id;

  perform public.record_compliance_event(
    v_crypto.user_id,
    'crypto_onramp_credited',
    'moonpay_onramp',
    'completed',
    null,
    jsonb_build_object(
      'amount', v_crypto.fiat_amount,
      'currency', v_crypto.fiat_currency,
      'crypto_transaction_id', v_crypto.id,
      'transaction_id', v_transaction_id
    ),
    p_provider,
    coalesce(p_provider_event_id, p_provider_transaction_id) || ':credit',
    null
  );

  return v_transaction_id;
end;
$$;
create or replace function public.prepare_regulatory_report_period(
  p_jurisdiction text,
  p_period_start date,
  p_period_end date
)
returns public.regulatory_report_periods
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_report public.regulatory_report_periods;
  v_totals jsonb;
begin
  if v_actor_id is not null and public.is_app_admin(v_actor_id) is not true then
    raise exception 'Only admins can prepare regulatory reports';
  end if;

  select jsonb_build_object(
    'fiat_deposits', coalesce(sum(amount) filter (where type = 'deposit' and status = 'completed'), 0),
    'withdrawals', coalesce(sum(abs(amount)) filter (where type = 'withdrawal' and status = 'completed'), 0),
    'live_positions', coalesce(sum(abs(amount)) filter (where type = 'bet_placed' and status = 'completed' and coalesce(is_play_mode, false) = false), 0),
    'settlement_credits', coalesce(sum(amount) filter (where type in ('bet_won', 'bet_refund') and status = 'completed'), 0),
    'crypto_onramps', (
      select coalesce(sum(ct.fiat_amount), 0)
      from public.crypto_transactions ct
      where ct.direction = 'onramp'
        and ct.created_at::date between p_period_start and p_period_end
    ),
    'crypto_offramps', (
      select coalesce(sum(ct.fiat_amount), 0)
      from public.crypto_transactions ct
      where ct.direction = 'offramp'
        and ct.created_at::date between p_period_start and p_period_end
    ),
    'unique_real_money_users', count(distinct user_id) filter (where coalesce(is_play_mode, false) = false),
    'event_count', (
      select count(*)
      from public.compliance_events ce
      where ce.created_at::date between p_period_start and p_period_end
    )
  )
  into v_totals
  from public.transactions
  where created_at::date between p_period_start and p_period_end;

  insert into public.regulatory_report_periods (
    jurisdiction,
    period_start,
    period_end,
    status,
    totals,
    prepared_by,
    prepared_at
  ) values (
    p_jurisdiction,
    p_period_start,
    p_period_end,
    'prepared',
    coalesce(v_totals, '{}'::jsonb),
    v_actor_id,
    now()
  )
  on conflict (jurisdiction, period_start, period_end) do update
    set status = 'prepared',
        totals = excluded.totals,
        prepared_by = excluded.prepared_by,
        prepared_at = now()
  returning * into v_report;

  perform public.record_compliance_event(
    null,
    'regulatory_report_prepared',
    'prepare_export',
    'prepared',
    p_jurisdiction,
    jsonb_build_object('period_start', p_period_start, 'period_end', p_period_end, 'totals', v_totals),
    null,
    null,
    null,
    v_actor_id
  );

  return v_report;
end;
$$;
-- Apply the compliance gate to the latest live-money bet function.
create or replace function public.place_bet(
  p_market_id uuid,
  p_option_id uuid,
  p_amount numeric,
  p_side text default 'yes',
  p_is_play_mode boolean default false
)
returns public.bets
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_market public.markets;
  v_wallet public.wallets;
  v_bet public.bets;
  v_option_label text;
  v_side text := lower(coalesce(p_side, 'yes'));
  v_current_balance numeric;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  if v_side not in ('yes', 'no') then
    raise exception 'Invalid side';
  end if;

  select * into v_market
  from public.markets m
  where m.id = p_market_id;

  if v_market.id is null then
    raise exception 'Market not found';
  end if;

  if not p_is_play_mode then
    perform public.assert_compliance_gate(v_user_id, 'live_position', p_market_id, p_amount, null, null, null);
  end if;

  if v_market.status <> 'open' then
    raise exception 'Market is not open';
  end if;

  if v_market.closes_at is not null and now() >= v_market.closes_at then
    raise exception 'Market is closed';
  end if;

  if v_market.is_public is not true then
    if not public.is_group_member(v_market.group_id, v_user_id) then
      raise exception 'Not a member of this group';
    end if;
  end if;

  select * into v_wallet
  from public.wallets w
  where w.user_id = v_user_id
  for update;

  if v_wallet.id is null then
    raise exception 'Wallet not found';
  end if;

  if p_is_play_mode then
    v_current_balance := v_wallet.play_balance;
  else
    v_current_balance := v_wallet.balance;
  end if;

  if v_current_balance < p_amount then
    raise exception 'Insufficient balance';
  end if;

  select label into v_option_label
  from public.options
  where id = p_option_id
    and market_id = p_market_id;

  if v_option_label is null then
    raise exception 'Option does not belong to market';
  end if;

  if p_is_play_mode then
    update public.wallets
    set play_balance = play_balance - p_amount
    where user_id = v_user_id;
  else
    update public.wallets
    set balance = balance - p_amount
    where user_id = v_user_id;
  end if;

  insert into public.bets(user_id, market_id, option_id, amount, side, is_play_mode)
  values (v_user_id, p_market_id, p_option_id, p_amount, v_side, p_is_play_mode)
  returning * into v_bet;

  insert into public.transactions (
    user_id,
    amount,
    type,
    status,
    reference_id,
    is_play_mode,
    metadata
  )
  values (
    v_user_id,
    -p_amount,
    'bet_placed',
    'completed',
    v_bet.id::text,
    p_is_play_mode,
    jsonb_build_object(
      'market_question', v_market.question,
      'option_label', v_option_label,
      'bet_id', v_bet.id,
      'market_id', p_market_id,
      'side', v_side,
      'is_play_mode', p_is_play_mode
    )
  )
  on conflict (reference_id, type) where reference_id is not null do nothing;

  return v_bet;
end;
$function$;
create or replace function public.transfer_wallet_funds(
  p_recipient_id uuid,
  p_amount numeric,
  p_note text default null,
  p_client_reference text default null
)
returns table (
  sender_transaction_id uuid,
  recipient_transaction_id uuid,
  sender_balance numeric,
  recipient_balance numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid := auth.uid();
  v_reference_id text := coalesce(nullif(trim(p_client_reference), ''), gen_random_uuid()::text);
  v_sender_tx_id uuid;
  v_recipient_tx_id uuid;
  v_sender_balance numeric;
  v_recipient_balance numeric;
  v_sender_name text;
  v_recipient_name text;
begin
  if v_sender_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_recipient_id is null then
    raise exception 'Recipient is required';
  end if;

  if p_recipient_id = v_sender_id then
    raise exception 'Cannot send funds to yourself';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  perform public.assert_compliance_gate(v_sender_id, 'transfer', null, p_amount, null, null, null);
  perform public.assert_compliance_gate(p_recipient_id, 'transfer', null, p_amount, null, null, null);

  select t.id
    into v_sender_tx_id
  from public.transactions t
  where t.reference_id = v_reference_id
    and t.type = 'transfer_sent'
    and t.user_id = v_sender_id
  limit 1;

  if v_sender_tx_id is not null then
    select t.id
      into v_recipient_tx_id
    from public.transactions t
    where t.reference_id = v_reference_id
      and t.type = 'transfer_received'
      and t.user_id = p_recipient_id
    limit 1;

    select w.balance into v_sender_balance
    from public.wallets w
    where w.user_id = v_sender_id;

    select w.balance into v_recipient_balance
    from public.wallets w
    where w.user_id = p_recipient_id;

    return query
    select v_sender_tx_id, v_recipient_tx_id, v_sender_balance, v_recipient_balance;
    return;
  end if;

  select username
    into v_sender_name
  from public.users
  where id = v_sender_id;

  select username
    into v_recipient_name
  from public.users
  where id = p_recipient_id;

  if v_recipient_name is null then
    raise exception 'Recipient not found';
  end if;

  insert into public.wallets (user_id, balance, is_virtual, currency)
  values (p_recipient_id, 0, false, 'USD')
  on conflict (user_id) do nothing;

  update public.wallets
    set balance = balance - p_amount,
        updated_at = now()
  where user_id = v_sender_id
    and balance >= p_amount
  returning balance into v_sender_balance;

  if v_sender_balance is null then
    raise exception 'Insufficient balance';
  end if;

  update public.wallets
    set balance = balance + p_amount,
        updated_at = now()
  where user_id = p_recipient_id
  returning balance into v_recipient_balance;

  if v_recipient_balance is null then
    raise exception 'Recipient wallet not found';
  end if;

  insert into public.transactions (
    user_id,
    amount,
    type,
    status,
    reference_id,
    metadata
  ) values (
    v_sender_id,
    -p_amount,
    'transfer_sent',
    'completed',
    v_reference_id,
    jsonb_build_object(
      'counterparty_user_id', p_recipient_id,
      'counterparty_username', v_recipient_name,
      'note', p_note
    )
  )
  returning id into v_sender_tx_id;

  insert into public.transactions (
    user_id,
    amount,
    type,
    status,
    reference_id,
    metadata
  ) values (
    p_recipient_id,
    p_amount,
    'transfer_received',
    'completed',
    v_reference_id,
    jsonb_build_object(
      'counterparty_user_id', v_sender_id,
      'counterparty_username', coalesce(v_sender_name, 'User'),
      'note', p_note
    )
  )
  returning id into v_recipient_tx_id;

  return query
  select v_sender_tx_id, v_recipient_tx_id, v_sender_balance, v_recipient_balance;
end;
$$;
-- RLS: users can read their own compliance status; service role/admin owns writes.
alter table public.policy_versions enable row level security;
alter table public.user_policy_acceptances enable row level security;
alter table public.user_compliance_profiles enable row level security;
alter table public.kyc_verification_sessions enable row level security;
alter table public.payment_provider_accounts enable row level security;
alter table public.crypto_transactions enable row level security;
alter table public.market_compliance_reviews enable row level security;
alter table public.compliance_events enable row level security;
alter table public.accounting_ledger_entries enable row level security;
alter table public.regulatory_report_periods enable row level security;
alter table public.compliance_jurisdiction_rules enable row level security;
alter table public.prohibited_market_categories enable row level security;
drop policy if exists "Policy versions are readable" on public.policy_versions;
create policy "Policy versions are readable"
  on public.policy_versions for select
  to anon, authenticated
  using (retired_at is null);
drop policy if exists "Users read own policy acceptances" on public.user_policy_acceptances;
create policy "Users read own policy acceptances"
  on public.user_policy_acceptances for select
  to authenticated
  using (user_id = auth.uid() or public.is_app_admin(auth.uid()));
drop policy if exists "Users insert own policy acceptances" on public.user_policy_acceptances;
create policy "Users insert own policy acceptances"
  on public.user_policy_acceptances for insert
  to authenticated
  with check (user_id = auth.uid());
drop policy if exists "Users read own compliance profile" on public.user_compliance_profiles;
create policy "Users read own compliance profile"
  on public.user_compliance_profiles for select
  to authenticated
  using (user_id = auth.uid() or public.is_app_admin(auth.uid()));
drop policy if exists "Users read own kyc sessions" on public.kyc_verification_sessions;
create policy "Users read own kyc sessions"
  on public.kyc_verification_sessions for select
  to authenticated
  using (user_id = auth.uid() or public.is_app_admin(auth.uid()));
drop policy if exists "Users read own payment provider accounts" on public.payment_provider_accounts;
create policy "Users read own payment provider accounts"
  on public.payment_provider_accounts for select
  to authenticated
  using (user_id = auth.uid() or public.is_app_admin(auth.uid()));
drop policy if exists "Users read own crypto transactions" on public.crypto_transactions;
create policy "Users read own crypto transactions"
  on public.crypto_transactions for select
  to authenticated
  using (user_id = auth.uid() or public.is_app_admin(auth.uid()));
drop policy if exists "Users read own compliance events" on public.compliance_events;
create policy "Users read own compliance events"
  on public.compliance_events for select
  to authenticated
  using (user_id = auth.uid() or actor_id = auth.uid() or public.is_app_admin(auth.uid()));
drop policy if exists "Members read market compliance reviews" on public.market_compliance_reviews;
create policy "Members read market compliance reviews"
  on public.market_compliance_reviews for select
  to authenticated
  using (
    public.is_app_admin(auth.uid())
    or exists (
      select 1
      from public.markets m
      where m.id = market_id
        and (
          m.is_public is true
          or public.is_group_member(m.group_id, auth.uid())
          or m.creator_id = auth.uid()
        )
    )
  );
drop policy if exists "Users read own accounting ledger" on public.accounting_ledger_entries;
create policy "Users read own accounting ledger"
  on public.accounting_ledger_entries for select
  to authenticated
  using (user_id = auth.uid() or public.is_app_admin(auth.uid()));
drop policy if exists "Admins read regulatory report periods" on public.regulatory_report_periods;
create policy "Admins read regulatory report periods"
  on public.regulatory_report_periods for select
  to authenticated
  using (public.is_app_admin(auth.uid()));
drop policy if exists "Jurisdiction rules readable" on public.compliance_jurisdiction_rules;
create policy "Jurisdiction rules readable"
  on public.compliance_jurisdiction_rules for select
  to authenticated
  using (true);
drop policy if exists "Market category rules readable" on public.prohibited_market_categories;
create policy "Market category rules readable"
  on public.prohibited_market_categories for select
  to authenticated
  using (true);
revoke all on function public.assert_compliance_gate(uuid, text, uuid, numeric, text, text, text) from public, anon;
grant execute on function public.assert_compliance_gate(uuid, text, uuid, numeric, text, text, text) to authenticated, service_role;
revoke all on function public.record_compliance_event(uuid, text, text, text, text, jsonb, text, text, uuid, uuid) from public, anon;
grant execute on function public.record_compliance_event(uuid, text, text, text, text, jsonb, text, text, uuid, uuid) to authenticated, service_role;
revoke all on function public.upsert_provider_compliance_status(uuid, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.upsert_provider_compliance_status(uuid, text, text, text, text, text, text, jsonb) to service_role;
revoke all on function public.upsert_crypto_transaction(uuid, text, text, text, text, numeric, text, numeric, text, text, text, text, numeric, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.upsert_crypto_transaction(uuid, text, text, text, text, numeric, text, numeric, text, text, text, text, numeric, text, jsonb, text) to service_role;
revoke all on function public.apply_crypto_onramp_credit(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_crypto_onramp_credit(text, text, text, jsonb) to service_role;
grant execute on function public.upsert_market_compliance_review(uuid, text, text, boolean, text, jsonb) to authenticated, service_role;
grant execute on function public.has_current_policy_acceptances(uuid) to authenticated, service_role;
grant execute on function public.prepare_regulatory_report_period(text, date, date) to authenticated, service_role;
commit;
