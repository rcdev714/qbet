-- Drop the old unique index on just reference_id (was only needed for Stripe idempotency)
-- We'll replace it with a composite index that allows the same reference_id with different types
DROP INDEX IF EXISTS transactions_reference_id_unique;

-- First, remove any duplicate transactions (keep the oldest one for each bet_id + type combo)
DELETE FROM public.transactions t1
WHERE t1.id IN (
  SELECT t2.id 
  FROM public.transactions t2
  WHERE t2.metadata->>'bet_id' IS NOT NULL
    AND EXISTS (
      SELECT 1 
      FROM public.transactions t3 
      WHERE t3.metadata->>'bet_id' = t2.metadata->>'bet_id'
        AND t3.type = t2.type
        AND t3.id != t2.id
        AND t3.created_at < t2.created_at
    )
);

-- Backfill reference_id from metadata for bet transactions
UPDATE public.transactions
SET reference_id = metadata->>'bet_id'
WHERE reference_id IS NULL 
  AND metadata->>'bet_id' IS NOT NULL;

-- Create composite unique index to prevent duplicate transactions for the same bet/type
-- This allows the same reference_id (bet_id) to appear in multiple transaction types
-- (e.g., bet_placed, bet_won, bet_lost all for the same bet_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_reference_type 
ON public.transactions (reference_id, type)
WHERE reference_id IS NOT NULL;

-- Update Stripe functions to use the composite unique constraint
CREATE OR REPLACE FUNCTION public.apply_wallet_topup(
  p_user_id uuid,
  p_amount numeric,
  p_reference_id text,
  p_event_id text,
  p_metadata jsonb default '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.stripe_events (id, type, livemode)
  VALUES (p_event_id, 'payment_intent.succeeded', (p_metadata->>'livemode')::boolean)
  ON CONFLICT DO NOTHING;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.wallets
    SET balance = balance + p_amount,
        total_deposited = total_deposited + p_amount,
        is_virtual = false,
        updated_at = now()
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
  END IF;

  INSERT INTO public.transactions (
    user_id,
    type,
    amount,
    status,
    reference_id,
    metadata
  ) VALUES (
    p_user_id,
    'deposit',
    p_amount,
    'completed',
    p_reference_id,
    p_metadata
  )
  ON CONFLICT (reference_id, type) WHERE reference_id IS NOT NULL DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_wallet_refund(
  p_user_id uuid,
  p_amount numeric,
  p_reference_id text,
  p_event_id text,
  p_metadata jsonb default '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.stripe_events (id, type, livemode)
  VALUES (p_event_id, 'charge.refunded', (p_metadata->>'livemode')::boolean)
  ON CONFLICT DO NOTHING;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.wallets
    SET balance = greatest(balance - p_amount, 0),
        total_deposited = greatest(total_deposited - p_amount, 0),
        updated_at = now()
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
  END IF;

  INSERT INTO public.transactions (
    user_id,
    type,
    amount,
    status,
    reference_id,
    metadata
  ) VALUES (
    p_user_id,
    'deposit',
    -p_amount,
    'completed',
    p_reference_id,
    p_metadata
  )
  ON CONFLICT (reference_id, type) WHERE reference_id IS NOT NULL DO NOTHING;
END;
$$;

-- Update place_bet to set reference_id
CREATE OR REPLACE FUNCTION public.place_bet(
  p_market_id uuid,
  p_option_id uuid,
  p_amount numeric,
  p_side text DEFAULT 'yes'
)
RETURNS bets
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_market public.markets;
  v_wallet public.wallets;
  v_bet public.bets;
  v_option_label text;
  v_side text := lower(coalesce(p_side, 'yes'));
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

  select * into v_market from public.markets m where m.id = p_market_id;
  if v_market.id is null then
    raise exception 'Market not found';
  end if;

  if v_market.status <> 'open' then
    raise exception 'Market is not open';
  end if;

  if v_market.closes_at is not null and now() >= v_market.closes_at then
    raise exception 'Market is closed';
  end if;

  -- Allow betting on public markets OR if user is a member of the market's group
  if v_market.is_public is not true then
    -- Only check group membership for non-public markets
    if not public.is_group_member(v_market.group_id, v_user_id) then
      raise exception 'Not a member of this group';
    end if;
  end if;

  select * into v_wallet from public.wallets w where w.user_id = v_user_id for update;
  if v_wallet.id is null then
    raise exception 'Wallet not found';
  end if;

  if v_wallet.balance < p_amount then
    raise exception 'Insufficient balance';
  end if;

  -- Get option label for metadata
  select label into v_option_label from public.options where id = p_option_id;

  update public.wallets
  set balance = balance - p_amount
  where user_id = v_user_id;

  insert into public.bets(user_id, market_id, option_id, amount, side)
  values (v_user_id, p_market_id, p_option_id, p_amount, v_side)
  returning * into v_bet;

  -- Log transaction with reference_id
  insert into public.transactions (user_id, amount, type, status, reference_id, metadata)
  values (
    v_user_id, 
    -p_amount, 
    'bet_placed', 
    'completed', 
    v_bet.id::text,
    jsonb_build_object(
      'market_question', v_market.question,
      'option_label', v_option_label,
      'bet_id', v_bet.id,
      'market_id', p_market_id,
      'side', v_side
    )
  );

  return v_bet;
end;
$function$;

-- Update resolve_market to set reference_id
CREATE OR REPLACE FUNCTION public.resolve_market(p_market_id uuid, p_winning_option_id uuid)
RETURNS markets
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_market public.markets;
  v_option record;
  v_bet record;
  v_total_pool numeric;
  v_winning_pool numeric;
  v_winning_side text;
  c_vig numeric := 0.0795;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- 1. Get and lock the market
  select * into v_market from public.markets m where m.id = p_market_id for update;
  if v_market.id is null then
    raise exception 'Market not found';
  end if;

  -- 2. Verify admin rights
  if not EXISTS (
    select 1 from public.group_members 
    where group_id = v_market.group_id 
      and user_id = v_user_id 
      and role = 'admin'
  ) then
    raise exception 'Only group admins can resolve markets';
  end if;

  if v_market.status = 'resolved' then
    raise exception 'Market already resolved';
  end if;

  -- 3. If there were no bets on anything, just close it
  select sum(total_pool) into v_total_pool from public.options where market_id = p_market_id;
  if v_total_pool = 0 or v_total_pool is null then
    update public.markets
    set status = 'resolved', resolved_at = now(), winning_option_id = p_winning_option_id
    where id = p_market_id
    returning * into v_market;
    return v_market;
  end if;

  -- 4. Resolve each option independently (YES wins for winning option, NO wins otherwise)
  for v_option in
    select id, label, yes_pool, no_pool
    from public.options
    where market_id = p_market_id
  loop
    declare
      v_loser_pool numeric;
      v_loser_pool_after_vig numeric;
    begin
      v_winning_side := case when v_option.id = p_winning_option_id then 'yes' else 'no' end;
      v_winning_pool := case when v_winning_side = 'yes' then v_option.yes_pool else v_option.no_pool end;
      v_loser_pool := case when v_winning_side = 'yes' then v_option.no_pool else v_option.yes_pool end;
      -- Vig is applied only to the loser pool (the profit), not the winners' stake
      v_loser_pool_after_vig := coalesce(v_loser_pool, 0) * (1 - c_vig);

      for v_bet in
        select b.id, b.user_id, b.amount, b.side
        from public.bets b
        where b.market_id = p_market_id and b.option_id = v_option.id
      loop
        declare
          v_payout_amount numeric := 0;
          v_type text := 'bet_lost';
        begin
          if v_bet.side = v_winning_side and v_winning_pool > 0 then
            -- Payout = original stake + proportional share of loser pool (after vig)
            v_payout_amount := v_bet.amount + (v_bet.amount / v_winning_pool) * v_loser_pool_after_vig;
            v_type := 'bet_won';

            update public.wallets
            set balance = balance + v_payout_amount
            where user_id = v_bet.user_id;
          end if;

          insert into public.transactions (user_id, amount, type, status, reference_id, metadata)
          values (
            v_bet.user_id,
            v_payout_amount,
            v_type,
            'completed',
            v_bet.id::text,
            jsonb_build_object(
              'market_question', v_market.question,
              'option_label', v_option.label,
              'bet_id', v_bet.id,
              'wager', v_bet.amount,
              'side', v_bet.side,
              'market_type', 'private'
            )
          )
          ON CONFLICT (reference_id, type) WHERE reference_id IS NOT NULL DO NOTHING;
        end;
      end loop;
    end;
  end loop;

  -- 5. Update market status
  update public.markets
  set status = 'resolved',
      resolved_at = now(),
      winning_option_id = p_winning_option_id
  where id = p_market_id
  returning * into v_market;

  return v_market;
end;
$function$;

-- Update resolve_public_market to set reference_id
CREATE OR REPLACE FUNCTION public.resolve_public_market(p_market_id uuid, p_winning_option_id uuid)
RETURNS markets
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_is_admin boolean;
  v_market public.markets;
  v_option record;
  v_bet record;
  v_total_pool numeric;
  v_winning_pool numeric;
  v_winning_side text;
  c_vig numeric := 0.0795;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- 1. Verify user is an app admin
  select is_admin into v_is_admin from public.users where id = v_user_id;
  if v_is_admin is not true then
    raise exception 'Only app admins can resolve public markets';
  end if;

  -- 2. Get and lock the market
  select * into v_market from public.markets m where m.id = p_market_id for update;
  if v_market.id is null then
    raise exception 'Market not found';
  end if;

  -- 3. Verify this is a public market
  if v_market.is_public is not true then
    raise exception 'This function only resolves public markets. Use resolve_market for group markets.';
  end if;

  if v_market.status = 'resolved' then
    raise exception 'Market already resolved';
  end if;

  -- 4. If there were no bets on anything, just close it
  select sum(total_pool) into v_total_pool from public.options where market_id = p_market_id;
  if v_total_pool = 0 or v_total_pool is null then
    update public.markets
    set status = 'resolved', resolved_at = now(), winning_option_id = p_winning_option_id
    where id = p_market_id
    returning * into v_market;
    return v_market;
  end if;

  -- 5. Resolve each option independently (YES wins for winning option, NO wins otherwise)
  for v_option in
    select id, label, yes_pool, no_pool
    from public.options
    where market_id = p_market_id
  loop
    declare
      v_loser_pool numeric;
      v_loser_pool_after_vig numeric;
    begin
      v_winning_side := case when v_option.id = p_winning_option_id then 'yes' else 'no' end;
      v_winning_pool := case when v_winning_side = 'yes' then v_option.yes_pool else v_option.no_pool end;
      v_loser_pool := case when v_winning_side = 'yes' then v_option.no_pool else v_option.yes_pool end;
      -- Vig is applied only to the loser pool (the profit), not the winners' stake
      v_loser_pool_after_vig := coalesce(v_loser_pool, 0) * (1 - c_vig);

      for v_bet in
        select b.id, b.user_id, b.amount, b.side
        from public.bets b
        where b.market_id = p_market_id and b.option_id = v_option.id
      loop
        declare
          v_payout_amount numeric := 0;
          v_type text := 'bet_lost';
        begin
          if v_bet.side = v_winning_side and v_winning_pool > 0 then
            -- Payout = original stake + proportional share of loser pool (after vig)
            v_payout_amount := v_bet.amount + (v_bet.amount / v_winning_pool) * v_loser_pool_after_vig;
            v_type := 'bet_won';

            update public.wallets
            set balance = balance + v_payout_amount
            where user_id = v_bet.user_id;
          end if;

          insert into public.transactions (user_id, amount, type, status, reference_id, metadata)
          values (
            v_bet.user_id,
            v_payout_amount,
            v_type,
            'completed',
            v_bet.id::text,
            jsonb_build_object(
              'market_question', v_market.question,
              'option_label', v_option.label,
              'bet_id', v_bet.id,
              'wager', v_bet.amount,
              'side', v_bet.side,
              'market_type', 'public'
            )
          )
          ON CONFLICT (reference_id, type) WHERE reference_id IS NOT NULL DO NOTHING;
        end;
      end loop;
    end;
  end loop;

  -- 6. Update market status
  update public.markets
  set status = 'resolved',
      resolved_at = now(),
      winning_option_id = p_winning_option_id
  where id = p_market_id
  returning * into v_market;

  return v_market;
end;
$function$;
