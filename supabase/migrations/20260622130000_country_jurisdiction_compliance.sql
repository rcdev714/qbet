begin;

-- ============================================================================
-- Country of residence, jurisdiction-scoped policies, and residence RPCs
-- ============================================================================

alter table public.users
  add column if not exists country_of_residence text,
  add column if not exists phone_e164 text,
  add column if not exists phone_country_code text,
  add column if not exists residence_set_at timestamptz;

create table if not exists public.supported_residence_countries (
  country_code text primary key,
  name text not null,
  dial_code text not null,
  default_jurisdiction text not null check (default_jurisdiction in ('EC', 'US')),
  is_launch_enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

insert into public.supported_residence_countries (country_code, name, dial_code, default_jurisdiction, sort_order)
values
  ('EC', 'Ecuador', '+593', 'EC', 1),
  ('US', 'United States', '+1', 'US', 2),
  ('CA', 'Canada', '+1', 'US', 10),
  ('MX', 'Mexico', '+52', 'US', 11),
  ('GB', 'United Kingdom', '+44', 'US', 12),
  ('DE', 'Germany', '+49', 'US', 13),
  ('FR', 'France', '+33', 'US', 14),
  ('ES', 'Spain', '+34', 'US', 15),
  ('CO', 'Colombia', '+57', 'US', 16),
  ('PE', 'Peru', '+51', 'US', 17),
  ('CL', 'Chile', '+56', 'US', 18),
  ('AR', 'Argentina', '+54', 'US', 19),
  ('BR', 'Brazil', '+55', 'US', 20),
  ('AU', 'Australia', '+61', 'US', 30),
  ('JP', 'Japan', '+81', 'US', 31),
  ('IN', 'India', '+91', 'US', 32)
on conflict (country_code) do update
  set name = excluded.name,
      dial_code = excluded.dial_code,
      default_jurisdiction = excluded.default_jurisdiction,
      sort_order = excluded.sort_order;

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
  'US',
  true,
  true,
  true,
  true,
  array['stripe', 'moonpay', 'btc_payout'],
  array['USDC', 'USDT', 'ETH', 'BTC'],
  'United States launch posture: standard KYC, ledger exports, and manual review for sensitive categories.'
) on conflict (jurisdiction) do update
  set public_sports_markets_allowed = excluded.public_sports_markets_allowed,
      real_money_requires_kyc = excluded.real_money_requires_kyc,
      crypto_rails_requires_provider_kyc = excluded.crypto_rails_requires_provider_kyc,
      tax_and_aml_export_required = excluded.tax_and_aml_export_required,
      allowed_payment_providers = excluded.allowed_payment_providers,
      allowed_crypto_assets = excluded.allowed_crypto_assets,
      notes = excluded.notes,
      updated_at = now();

alter table public.policy_versions
  add column if not exists jurisdiction text not null default 'US';

update public.policy_versions
set jurisdiction = 'EC'
where jurisdiction = 'US'
  and version = '2026-05-14';

alter table public.policy_versions
  drop constraint if exists policy_versions_kind_version_key;

alter table public.policy_versions
  add constraint policy_versions_kind_version_jurisdiction_key
  unique (kind, version, jurisdiction);

insert into public.policy_versions(kind, version, title, url, content_hash, is_required, effective_at, jurisdiction)
values
  ('terms', '2026-06-22', 'Terms of Service', '/terms', 'pending-legal-hash-terms-2026-06-22-us', true, now(), 'US'),
  ('privacy', '2026-06-22', 'Privacy Policy', '/privacy', 'pending-legal-hash-privacy-2026-06-22-us', true, now(), 'US'),
  ('risk_disclosure', '2026-06-22', 'Real-Money Market Risk Disclosure', '/risk', 'pending-legal-hash-risk-2026-06-22-us', true, now(), 'US'),
  ('market_rules', '2026-06-22', 'Market Creation and Resolution Rules', '/market-rules', 'pending-legal-hash-market-rules-2026-06-22-us', true, now(), 'US'),
  ('aml_kyc', '2026-06-22', 'AML and KYC Policy', '/aml-kyc', 'pending-legal-hash-aml-kyc-2026-06-22-us', true, now(), 'US'),
  ('prohibited_markets', '2026-06-22', 'Prohibited Markets Policy', '/prohibited-markets', 'pending-legal-hash-prohibited-markets-2026-06-22-us', true, now(), 'US')
on conflict (kind, version, jurisdiction) do nothing;

create or replace function public.resolve_compliance_jurisdiction(p_country text)
returns text
language sql
immutable
as $$
  select case when upper(coalesce(p_country, '')) = 'EC' then 'EC' else 'US' end;
$$;

create or replace function public.get_user_compliance_jurisdiction(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select ucp.jurisdiction
      from public.user_compliance_profiles ucp
      where ucp.user_id = p_user_id
    ),
    public.resolve_compliance_jurisdiction(
      (
        select u.country_of_residence
        from public.users u
        where u.id = p_user_id
      )
    )
  );
$$;

create or replace function public.has_current_policy_acceptances(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with user_jurisdiction as (
    select public.get_user_compliance_jurisdiction(p_user_id) as jurisdiction
  ),
  required_policies as (
    select distinct on (pv.kind) pv.id, pv.kind
    from public.policy_versions pv
    cross join user_jurisdiction uj
    where pv.is_required is true
      and pv.retired_at is null
      and pv.effective_at <= now()
      and pv.jurisdiction = uj.jurisdiction
    order by pv.kind, pv.effective_at desc, pv.created_at desc
  )
  select case
    when not exists (select 1 from public.users u where u.id = p_user_id and u.country_of_residence is not null)
      then false
    when not exists (select 1 from required_policies)
      then false
    else not exists (
      select 1
      from required_policies rp
      where not exists (
        select 1
        from public.user_policy_acceptances upa
        where upa.user_id = p_user_id
          and upa.policy_version_id = rp.id
      )
    )
  end;
$$;

create or replace function public.clear_jurisdiction_policy_acceptances(p_user_id uuid, p_jurisdiction text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.user_policy_acceptances upa
  using public.policy_versions pv
  where upa.user_id = p_user_id
    and upa.policy_version_id = pv.id
    and pv.jurisdiction = p_jurisdiction;
end;
$$;

create or replace function public.set_user_residence(
  p_country text,
  p_phone_e164 text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_country text;
  v_country record;
  v_jurisdiction text;
  v_dial_code text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select u.country_of_residence into v_existing_country
  from public.users u
  where u.id = v_user_id;

  if v_existing_country is not null and not public.is_app_admin(v_user_id) then
    raise exception 'Country of residence is already set and cannot be changed'
      using errcode = 'P0001', hint = 'residence_locked';
  end if;

  select *
  into v_country
  from public.supported_residence_countries src
  where src.country_code = upper(p_country)
    and src.is_launch_enabled is true;

  if not found then
    raise exception 'Unsupported country of residence'
      using errcode = '22023', hint = 'unsupported_country';
  end if;

  if p_phone_e164 is not null and p_phone_e164 !~ '^\+[1-9]\d{6,14}$' then
    raise exception 'Invalid phone number format'
      using errcode = '22023', hint = 'invalid_phone';
  end if;

  v_jurisdiction := public.resolve_compliance_jurisdiction(v_country.country_code);
  v_dial_code := v_country.dial_code;

  update public.users
  set
    country_of_residence = v_country.country_code,
    phone_e164 = p_phone_e164,
    phone_country_code = case when p_phone_e164 is not null then v_dial_code else null end,
    residence_set_at = now()
  where id = v_user_id;

  update public.wallets
  set country = v_country.country_code,
      updated_at = now()
  where user_id = v_user_id;

  insert into public.user_compliance_profiles (user_id, jurisdiction)
  values (v_user_id, v_jurisdiction)
  on conflict (user_id) do update
    set jurisdiction = excluded.jurisdiction,
        updated_at = now();

  return jsonb_build_object(
    'country', v_country.country_code,
    'jurisdiction', v_jurisdiction,
    'dial_code', v_dial_code
  );
end;
$$;

create or replace function public.update_user_phone(p_phone_e164 text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_country text;
  v_dial_code text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select u.country_of_residence into v_country
  from public.users u
  where u.id = v_user_id;

  if v_country is null then
    raise exception 'Set country of residence before adding a phone number'
      using errcode = 'P0001', hint = 'missing_residence';
  end if;

  if p_phone_e164 is not null and p_phone_e164 !~ '^\+[1-9]\d{6,14}$' then
    raise exception 'Invalid phone number format'
      using errcode = '22023', hint = 'invalid_phone';
  end if;

  select src.dial_code into v_dial_code
  from public.supported_residence_countries src
  where src.country_code = v_country;

  update public.users
  set
    phone_e164 = p_phone_e164,
    phone_country_code = case when p_phone_e164 is not null then v_dial_code else null end
  where id = v_user_id;

  return jsonb_build_object('phone_e164', p_phone_e164);
end;
$$;

create or replace function public.admin_update_user_residence(
  p_user_id uuid,
  p_country text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_country record;
  v_old_jurisdiction text;
  v_new_jurisdiction text;
begin
  if v_admin_id is null or not public.is_app_admin(v_admin_id) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select *
  into v_country
  from public.supported_residence_countries src
  where src.country_code = upper(p_country)
    and src.is_launch_enabled is true;

  if not found then
    raise exception 'Unsupported country of residence'
      using errcode = '22023', hint = 'unsupported_country';
  end if;

  v_old_jurisdiction := public.get_user_compliance_jurisdiction(p_user_id);
  v_new_jurisdiction := public.resolve_compliance_jurisdiction(v_country.country_code);

  update public.users
  set
    country_of_residence = v_country.country_code,
    residence_set_at = coalesce(residence_set_at, now())
  where id = p_user_id;

  update public.wallets
  set country = v_country.country_code,
      updated_at = now()
  where user_id = p_user_id;

  insert into public.user_compliance_profiles (user_id, jurisdiction)
  values (p_user_id, v_new_jurisdiction)
  on conflict (user_id) do update
    set jurisdiction = excluded.jurisdiction,
        updated_at = now();

  if v_old_jurisdiction is distinct from v_new_jurisdiction then
    perform public.clear_jurisdiction_policy_acceptances(p_user_id, v_old_jurisdiction);
    perform public.clear_jurisdiction_policy_acceptances(p_user_id, v_new_jurisdiction);
  end if;

  return jsonb_build_object(
    'country', v_country.country_code,
    'jurisdiction', v_new_jurisdiction,
    'policies_cleared', v_old_jurisdiction is distinct from v_new_jurisdiction
  );
end;
$$;

alter table public.supported_residence_countries enable row level security;

drop policy if exists "Supported countries are readable" on public.supported_residence_countries;
create policy "Supported countries are readable"
  on public.supported_residence_countries for select
  to anon, authenticated
  using (is_launch_enabled is true);

grant execute on function public.resolve_compliance_jurisdiction(text) to authenticated, service_role;
grant execute on function public.get_user_compliance_jurisdiction(uuid) to authenticated, service_role;
grant execute on function public.set_user_residence(text, text) to authenticated, service_role;
grant execute on function public.update_user_phone(text) to authenticated, service_role;
grant execute on function public.admin_update_user_residence(uuid, text) to authenticated, service_role;
grant execute on function public.clear_jurisdiction_policy_acceptances(uuid, text) to service_role;

commit;
