-- Stripe webhook idempotency and atomic wallet updates

create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  livemode boolean,
  created_at timestamptz default now()
);

create unique index if not exists transactions_reference_id_unique
  on public.transactions (reference_id)
  where reference_id is not null;

create or replace function public.apply_wallet_topup(
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
  on conflict (reference_id) do nothing;
end;
$$;

create or replace function public.apply_wallet_refund(
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
  on conflict (reference_id) do nothing;
end;
$$;
