-- Wallet withdrawal reservation and reconciliation helpers

create or replace function public.reserve_wallet_withdrawal(
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
  on conflict (reference_id) do nothing;

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
    where reference_id = p_reference_id;

    raise exception 'Insufficient balance for withdrawal';
  end if;

  return true;
end;
$$;

create or replace function public.finalize_wallet_withdrawal(
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

create or replace function public.fail_wallet_withdrawal(
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
