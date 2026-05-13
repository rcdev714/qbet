begin;

-- Extend allowed transaction types for peer transfers.
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
        'transfer_received'
      ]
    )
  );

-- Lookup helper used by the wallet send flow.
create or replace function public.lookup_wallet_recipient(
  p_query text
)
returns table (
  user_id uuid,
  username text,
  email text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_query text := lower(trim(coalesce(p_query, '')));
begin
  if v_caller_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_query = '' then
    return;
  end if;

  if left(v_query, 1) = '@' then
    v_query := substring(v_query from 2);
  end if;

  return query
  select
    u.id,
    u.username,
    u.email
  from public.users u
  where u.id <> v_caller_id
    and (
      lower(coalesce(u.username, '')) = v_query
      or lower(coalesce(u.email, '')) = v_query
    )
  limit 1;
end;
$$;

-- Atomic wallet transfer (sender debit + recipient credit + mirrored journal rows).
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

  -- Idempotency: if this reference already transferred, return existing result.
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

revoke all on function public.lookup_wallet_recipient(text) from public, anon;
grant execute on function public.lookup_wallet_recipient(text) to authenticated, service_role;

revoke all on function public.transfer_wallet_funds(uuid, numeric, text, text) from public, anon;
grant execute on function public.transfer_wallet_funds(uuid, numeric, text, text) to authenticated, service_role;

commit;
