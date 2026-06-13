begin;

create table if not exists public.stripe_charge_refunds (
  charge_id text primary key,
  refunded_amount numeric not null default 0 check (refunded_amount >= 0),
  last_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stripe_charge_refunds enable row level security;

drop policy if exists "Service role only" on public.stripe_charge_refunds;
create policy "Service role only"
  on public.stripe_charge_refunds
  for all
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

create or replace function internal_payments.apply_wallet_topup(
  p_user_id uuid,
  p_amount numeric,
  p_reference_id text,
  p_event_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Top-up amount must be positive';
  end if;

  insert into public.stripe_events (id, type, livemode)
  values (p_event_id, 'payment_intent.succeeded', (p_metadata->>'livemode')::boolean)
  on conflict do nothing;

  if not found then
    return;
  end if;

  update public.wallets
    set balance = balance + p_amount,
        total_deposited = coalesce(total_deposited, 0) + p_amount,
        is_virtual = false,
        updated_at = now()
  where user_id = p_user_id;

  if not found then
    raise exception 'Wallet not found for user %', p_user_id;
  end if;

  insert into public.transactions (
    user_id,
    type,
    amount,
    status,
    reference_id,
    metadata
  ) values (
    p_user_id,
    'deposit',
    p_amount,
    'completed',
    p_reference_id,
    p_metadata
  )
  on conflict (reference_id, type) where reference_id is not null do update
    set amount = excluded.amount,
        status = 'completed',
        metadata = coalesce(public.transactions.metadata, '{}'::jsonb) || excluded.metadata
    where public.transactions.status <> 'completed';
end;
$$;

create or replace function internal_payments.apply_wallet_refund(
  p_user_id uuid,
  p_amount numeric,
  p_reference_id text,
  p_event_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_effective_amount numeric := p_amount;
  v_previous_refunded numeric;
  v_charge_id text := nullif(p_metadata->>'stripe_charge_id', '');
  v_is_cumulative boolean := coalesce((p_metadata->>'refund_is_cumulative')::boolean, false);
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Refund amount must be positive';
  end if;

  insert into public.stripe_events (id, type, livemode)
  values (p_event_id, coalesce(p_metadata->>'event_type', 'refund.processed'), (p_metadata->>'livemode')::boolean)
  on conflict do nothing;

  if not found then
    return;
  end if;

  if not v_is_cumulative and exists (
    select 1
    from public.transactions
    where reference_id = p_reference_id
      and type = 'deposit'
  ) then
    return;
  end if;

  if v_is_cumulative then
    if v_charge_id is null then
      raise exception 'stripe_charge_id is required for cumulative refunds';
    end if;

    select refunded_amount
      into v_previous_refunded
    from public.stripe_charge_refunds
    where charge_id = v_charge_id
    for update;

    if not found then
      v_previous_refunded := 0;
      insert into public.stripe_charge_refunds (
        charge_id,
        refunded_amount,
        last_event_id,
        metadata
      ) values (
        v_charge_id,
        p_amount,
        p_event_id,
        p_metadata
      );
    else
      if p_amount <= v_previous_refunded then
        return;
      end if;

      update public.stripe_charge_refunds
        set refunded_amount = p_amount,
            last_event_id = p_event_id,
            metadata = coalesce(metadata, '{}'::jsonb) || p_metadata,
            updated_at = now()
      where charge_id = v_charge_id;
    end if;

    v_effective_amount := p_amount - v_previous_refunded;
  end if;

  update public.wallets
    set balance = greatest(balance - v_effective_amount, 0),
        total_deposited = greatest(coalesce(total_deposited, 0) - v_effective_amount, 0),
        updated_at = now()
  where user_id = p_user_id;

  if not found then
    raise exception 'Wallet not found for user %', p_user_id;
  end if;

  insert into public.transactions (
    user_id,
    type,
    amount,
    status,
    reference_id,
    metadata
  ) values (
    p_user_id,
    'deposit',
    -v_effective_amount,
    'completed',
    p_reference_id,
    p_metadata || jsonb_build_object('effective_refund_amount', v_effective_amount)
  )
  on conflict (reference_id, type) where reference_id is not null do nothing;

  if not v_is_cumulative and v_charge_id is not null then
    insert into public.stripe_charge_refunds (
      charge_id,
      refunded_amount,
      last_event_id,
      metadata
    ) values (
      v_charge_id,
      v_effective_amount,
      p_event_id,
      p_metadata
    )
    on conflict (charge_id) do update
      set refunded_amount = public.stripe_charge_refunds.refunded_amount + excluded.refunded_amount,
          last_event_id = excluded.last_event_id,
          metadata = public.stripe_charge_refunds.metadata || excluded.metadata,
          updated_at = now();
  end if;
end;
$$;

create or replace function public.apply_wallet_topup(
  p_user_id uuid,
  p_amount numeric,
  p_reference_id text,
  p_event_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
set search_path = public, internal_payments
as $$
  select internal_payments.apply_wallet_topup(
    p_user_id,
    p_amount,
    p_reference_id,
    p_event_id,
    p_metadata
  );
$$;

create or replace function public.apply_wallet_refund(
  p_user_id uuid,
  p_amount numeric,
  p_reference_id text,
  p_event_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
set search_path = public, internal_payments
as $$
  select internal_payments.apply_wallet_refund(
    p_user_id,
    p_amount,
    p_reference_id,
    p_event_id,
    p_metadata
  );
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
  v_existing_status text;
  v_existing_profile_status text;
  v_normalized_status text := coalesce(p_status, 'pending');
  v_effective_status text;
  v_terminal_statuses text[] := array['rejected', 'provider_restricted'];
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  insert into public.user_compliance_profiles(user_id, kyc_provider)
  values (p_user_id, p_provider)
  on conflict (user_id) do nothing;

  select status into v_existing_status
  from public.kyc_verification_sessions
  where provider = p_provider
    and provider_session_id = p_provider_session_id;

  select kyc_status into v_existing_profile_status
  from public.user_compliance_profiles
  where user_id = p_user_id;

  v_effective_status := case
    when v_existing_status = 'verified'
      and not (v_normalized_status = any (v_terminal_statuses))
      then 'verified'
    when v_existing_profile_status = 'verified'
      and not (v_normalized_status = any (v_terminal_statuses))
      then 'verified'
    else v_normalized_status
  end;

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
    v_effective_status,
    p_provider_event_id,
    case when v_effective_status = 'verified' then now() else null end,
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
        kyc_status = v_effective_status,
        age_verified = case when v_effective_status = 'verified' then true else age_verified end,
        live_wallet_enabled = case when v_effective_status = 'verified' then true else live_wallet_enabled end,
        crypto_rails_enabled = case when v_effective_status = 'verified' then true else crypto_rails_enabled end,
        verified_at = case when v_effective_status = 'verified' then coalesce(verified_at, now()) else verified_at end,
        review_status = case
          when v_effective_status = 'verified' then 'approved'
          when v_effective_status in ('requires_review', 'manual_review') then 'pending'
          when v_effective_status in ('rejected', 'provider_restricted') then 'rejected'
          else review_status
        end,
        updated_at = now()
  where user_id = p_user_id;

  perform public.record_compliance_event(
    p_user_id,
    'kyc_status_changed',
    'provider_update',
    v_effective_status,
    null,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'raw_provider_status', v_normalized_status
    ),
    p_provider,
    p_provider_event_id,
    null
  );

  return v_session;
end;
$$;

revoke all on table public.stripe_charge_refunds from public, anon, authenticated;
grant all on table public.stripe_charge_refunds to service_role;

revoke all on function internal_payments.apply_wallet_topup(uuid, numeric, text, text, jsonb) from public, anon, authenticated;
revoke all on function internal_payments.apply_wallet_refund(uuid, numeric, text, text, jsonb) from public, anon, authenticated;
grant execute on function internal_payments.apply_wallet_topup(uuid, numeric, text, text, jsonb) to service_role;
grant execute on function internal_payments.apply_wallet_refund(uuid, numeric, text, text, jsonb) to service_role;

revoke all on function public.apply_wallet_topup(uuid, numeric, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.apply_wallet_refund(uuid, numeric, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_wallet_topup(uuid, numeric, text, text, jsonb) to service_role;
grant execute on function public.apply_wallet_refund(uuid, numeric, text, text, jsonb) to service_role;

revoke all on function public.upsert_provider_compliance_status(uuid, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.upsert_provider_compliance_status(uuid, text, text, text, text, text, text, jsonb) to service_role;

commit;
