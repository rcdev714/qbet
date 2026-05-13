-- Phase 1 authz hardening:
-- 1. Prevent self-escalation through public.users updates
-- 2. Remove broad group_members insert access
-- 3. Restrict privileged payment helpers to service_role-only RPC access

begin;

-- ============================================================================
-- users: prevent self-escalation on protected columns
-- ============================================================================

revoke update on table public.users from anon, authenticated;
grant update (username, avatar_url) on table public.users to authenticated;
grant update on table public.users to service_role;

create or replace function public.prevent_self_privilege_escalation_on_users()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if auth.uid() = old.id and (
    new.id is distinct from old.id
    or new.email is distinct from old.email
    or new.created_at is distinct from old.created_at
    or new.is_admin is distinct from old.is_admin
    or new.stripe_customer_id is distinct from old.stripe_customer_id
  ) then
    raise exception 'Not authorized to update protected profile fields'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_self_privilege_escalation_on_users on public.users;
create trigger prevent_self_privilege_escalation_on_users
before update on public.users
for each row
execute function public.prevent_self_privilege_escalation_on_users();

-- ============================================================================
-- group_members: remove broad authenticated insert path
-- ============================================================================

drop policy if exists "Members can be added to groups" on public.group_members;
drop policy if exists "group_members_insert_admin" on public.group_members;
drop policy if exists "group_members_insert_self" on public.group_members;
drop policy if exists "group_members_insert_owner_bootstrap" on public.group_members;

create policy "group_members_insert_admin"
    on public.group_members
    for insert
    with check (is_group_admin(group_id, (select auth.uid())));

create policy "group_members_insert_owner_bootstrap"
    on public.group_members
    for insert
    with check (
        (select auth.uid()) = user_id
        and role = 'admin'
        and exists (
            select 1
            from public.groups g
            where g.id = group_members.group_id
              and g.admin_id = (select auth.uid())
        )
    );

-- ============================================================================
-- payment helpers: move privileged logic into private schema and expose only
-- service_role wrappers in public
-- ============================================================================

create schema if not exists internal_payments;

revoke all on schema internal_payments from public;
revoke all on schema internal_payments from anon;
revoke all on schema internal_payments from authenticated;
grant usage on schema internal_payments to service_role;

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
  insert into public.stripe_events (id, type, livemode)
  values (p_event_id, 'payment_intent.succeeded', (p_metadata->>'livemode')::boolean)
  on conflict do nothing;

  if not found then
    return;
  end if;

  update public.wallets
    set balance = balance + p_amount,
        total_deposited = total_deposited + p_amount,
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
  on conflict (reference_id, type) where reference_id is not null do nothing;
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
begin
  insert into public.stripe_events (id, type, livemode)
  values (p_event_id, 'charge.refunded', (p_metadata->>'livemode')::boolean)
  on conflict do nothing;

  if not found then
    return;
  end if;

  update public.wallets
    set balance = greatest(balance - p_amount, 0),
        total_deposited = greatest(total_deposited - p_amount, 0),
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
    -p_amount,
    'completed',
    p_reference_id,
    p_metadata
  )
  on conflict (reference_id, type) where reference_id is not null do nothing;
end;
$$;

create or replace function internal_payments.reserve_wallet_withdrawal(
  p_user_id uuid,
  p_amount numeric,
  p_reference_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.transactions (
    user_id,
    type,
    amount,
    status,
    reference_id,
    metadata
  ) values (
    p_user_id,
    'withdrawal',
    p_amount,
    'pending',
    p_reference_id,
    p_metadata
  )
  on conflict (reference_id, type) where reference_id is not null do nothing;

  if not found then
    return false;
  end if;

  update public.wallets
    set balance = balance - p_amount,
        updated_at = now()
  where user_id = p_user_id
    and balance >= p_amount;

  if not found then
    update public.transactions
      set status = 'failed',
          metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
            'failure_reason', 'insufficient_balance'
          )
    where reference_id = p_reference_id
      and type = 'withdrawal';

    raise exception 'Insufficient balance for withdrawal';
  end if;

  return true;
end;
$$;

create or replace function internal_payments.finalize_wallet_withdrawal(
  p_reference_id text,
  p_transfer_id text,
  p_fee_amount numeric,
  p_net_amount numeric,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_amount numeric;
begin
  update public.transactions
    set status = 'completed',
        fee_amount = p_fee_amount,
        net_amount = p_net_amount,
        metadata = coalesce(metadata, '{}'::jsonb)
          || p_metadata
          || jsonb_build_object('stripe_transfer_id', p_transfer_id)
  where reference_id = p_reference_id
    and type = 'withdrawal'
    and status <> 'completed'
  returning user_id, amount into v_user_id, v_amount;

  if not found then
    return;
  end if;

  update public.wallets
    set total_withdrawn = total_withdrawn + v_amount,
        updated_at = now()
  where user_id = v_user_id;
end;
$$;

create or replace function internal_payments.fail_wallet_withdrawal(
  p_reference_id text,
  p_failure_code text,
  p_failure_message text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_amount numeric;
begin
  update public.transactions
    set status = 'failed',
        metadata = coalesce(metadata, '{}'::jsonb)
          || p_metadata
          || jsonb_build_object(
            'failure_code', p_failure_code,
            'failure_message', p_failure_message
          )
  where reference_id = p_reference_id
    and type = 'withdrawal'
    and status <> 'failed'
  returning user_id, amount into v_user_id, v_amount;

  if not found then
    return;
  end if;

  update public.wallets
    set balance = balance + v_amount,
        total_withdrawn = greatest(total_withdrawn - v_amount, 0),
        updated_at = now()
  where user_id = v_user_id;
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

create or replace function public.reserve_wallet_withdrawal(
  p_user_id uuid,
  p_amount numeric,
  p_reference_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language sql
set search_path = public, internal_payments
as $$
  select internal_payments.reserve_wallet_withdrawal(
    p_user_id,
    p_amount,
    p_reference_id,
    p_metadata
  );
$$;

create or replace function public.finalize_wallet_withdrawal(
  p_reference_id text,
  p_transfer_id text,
  p_fee_amount numeric,
  p_net_amount numeric,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
set search_path = public, internal_payments
as $$
  select internal_payments.finalize_wallet_withdrawal(
    p_reference_id,
    p_transfer_id,
    p_fee_amount,
    p_net_amount,
    p_metadata
  );
$$;

create or replace function public.fail_wallet_withdrawal(
  p_reference_id text,
  p_failure_code text,
  p_failure_message text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
set search_path = public, internal_payments
as $$
  select internal_payments.fail_wallet_withdrawal(
    p_reference_id,
    p_failure_code,
    p_failure_message,
    p_metadata
  );
$$;

revoke all on function internal_payments.apply_wallet_topup(uuid, numeric, text, text, jsonb) from public, anon, authenticated;
revoke all on function internal_payments.apply_wallet_refund(uuid, numeric, text, text, jsonb) from public, anon, authenticated;
revoke all on function internal_payments.reserve_wallet_withdrawal(uuid, numeric, text, jsonb) from public, anon, authenticated;
revoke all on function internal_payments.finalize_wallet_withdrawal(text, text, numeric, numeric, jsonb) from public, anon, authenticated;
revoke all on function internal_payments.fail_wallet_withdrawal(text, text, text, jsonb) from public, anon, authenticated;

grant execute on function internal_payments.apply_wallet_topup(uuid, numeric, text, text, jsonb) to service_role;
grant execute on function internal_payments.apply_wallet_refund(uuid, numeric, text, text, jsonb) to service_role;
grant execute on function internal_payments.reserve_wallet_withdrawal(uuid, numeric, text, jsonb) to service_role;
grant execute on function internal_payments.finalize_wallet_withdrawal(text, text, numeric, numeric, jsonb) to service_role;
grant execute on function internal_payments.fail_wallet_withdrawal(text, text, text, jsonb) to service_role;

revoke all on function public.apply_wallet_topup(uuid, numeric, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.apply_wallet_refund(uuid, numeric, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.reserve_wallet_withdrawal(uuid, numeric, text, jsonb) from public, anon, authenticated;
revoke all on function public.finalize_wallet_withdrawal(text, text, numeric, numeric, jsonb) from public, anon, authenticated;
revoke all on function public.fail_wallet_withdrawal(text, text, text, jsonb) from public, anon, authenticated;

grant execute on function public.apply_wallet_topup(uuid, numeric, text, text, jsonb) to service_role;
grant execute on function public.apply_wallet_refund(uuid, numeric, text, text, jsonb) to service_role;
grant execute on function public.reserve_wallet_withdrawal(uuid, numeric, text, jsonb) to service_role;
grant execute on function public.finalize_wallet_withdrawal(text, text, numeric, numeric, jsonb) to service_role;
grant execute on function public.fail_wallet_withdrawal(text, text, text, jsonb) to service_role;

commit;
