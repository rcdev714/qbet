-- ============================================================================
-- PLAY MODE FEATURE
-- Adds play_balance to wallets and is_play_mode flag to bets/transactions
-- Play money is completely separate from real money (Stripe)
-- ============================================================================

-- 1. Add play_balance column to wallets (default $1000)
ALTER TABLE public.wallets 
ADD COLUMN IF NOT EXISTS play_balance numeric DEFAULT 1000 CHECK (play_balance >= 0);

-- 2. Add is_play_mode flag to bets
ALTER TABLE public.bets 
ADD COLUMN IF NOT EXISTS is_play_mode boolean DEFAULT false;

-- 3. Add is_play_mode flag to transactions
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS is_play_mode boolean DEFAULT false;

-- 4. Update transactions type enum to include 'play_credit_refresh'
ALTER TABLE public.transactions 
DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions 
ADD CONSTRAINT transactions_type_check 
CHECK (type = ANY (ARRAY['deposit', 'withdrawal', 'bet_placed', 'bet_won', 'bet_refund', 'bet_lost', 'play_credit_refresh']));

-- ============================================================================
-- 5. UPDATE place_bet FUNCTION TO HANDLE PLAY MODE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.place_bet(
  p_market_id uuid,
  p_option_id uuid,
  p_amount numeric,
  p_side text DEFAULT 'yes',
  p_is_play_mode boolean DEFAULT false
)
RETURNS bets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
    if not public.is_group_member(v_market.group_id, v_user_id) then
      raise exception 'Not a member of this group';
    end if;
  end if;

  select * into v_wallet from public.wallets w where w.user_id = v_user_id for update;
  if v_wallet.id is null then
    raise exception 'Wallet not found';
  end if;

  -- Determine which balance to use based on play mode
  if p_is_play_mode then
    v_current_balance := v_wallet.play_balance;
  else
    v_current_balance := v_wallet.balance;
  end if;

  -- Check sufficient balance
  if v_current_balance < p_amount then
    raise exception 'Insufficient balance';
  end if;

  -- Get option label for metadata
  select label into v_option_label from public.options where id = p_option_id;

  -- Deduct from appropriate balance
  if p_is_play_mode then
    update public.wallets
    set play_balance = play_balance - p_amount
    where user_id = v_user_id;
  else
    update public.wallets
    set balance = balance - p_amount
    where user_id = v_user_id;
  end if;

  -- Insert bet with is_play_mode flag
  insert into public.bets(user_id, market_id, option_id, amount, side, is_play_mode)
  values (v_user_id, p_market_id, p_option_id, p_amount, v_side, p_is_play_mode)
  returning * into v_bet;

  -- Log transaction with is_play_mode flag
  insert into public.transactions (user_id, amount, type, status, is_play_mode, metadata)
  values (
    v_user_id, 
    -p_amount, 
    'bet_placed', 
    'completed',
    p_is_play_mode,
    jsonb_build_object(
      'market_question', v_market.question,
      'option_label', v_option_label,
      'bet_id', v_bet.id,
      'market_id', p_market_id,
      'side', v_side,
      'is_play_mode', p_is_play_mode
    )
  );

  return v_bet;
end;
$function$;

-- ============================================================================
-- 6. FUNCTION TO REFRESH PLAY CREDITS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.refresh_play_credits()
RETURNS wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_wallet public.wallets;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Update play_balance to 1000
  update public.wallets
  set play_balance = 1000,
      updated_at = now()
  where user_id = v_user_id
  returning * into v_wallet;

  if v_wallet.id is null then
    raise exception 'Wallet not found';
  end if;

  -- Log the refresh as a transaction
  insert into public.transactions (user_id, amount, type, status, is_play_mode, metadata)
  values (
    v_user_id,
    1000,
    'play_credit_refresh',
    'completed',
    true,
    jsonb_build_object('refreshed_at', now())
  );

  return v_wallet;
end;
$function$;

-- ============================================================================
-- 7. UPDATE resolve_market_with_vig TO PAY OUT CORRECTLY
-- This function needs to pay to play_balance or balance based on bet's is_play_mode
-- ============================================================================

-- First, let's see the current resolve function and update it
-- We need to update the payout logic to check is_play_mode on each bet

CREATE OR REPLACE FUNCTION public.resolve_market_with_vig(
  p_market_id uuid,
  p_winning_option_id uuid,
  p_vig_percent numeric DEFAULT 0.05
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_market public.markets;
  v_total_pool numeric := 0;
  v_winning_pool numeric := 0;
  v_losing_pool numeric := 0;
  v_vig_amount numeric := 0;
  v_net_pool numeric := 0;
  v_bet record;
  v_payout numeric;
  v_option_label text;
  v_is_admin boolean;
  v_is_creator boolean;
  v_is_group_admin boolean := false;
begin
  -- Auth check
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Get market
  select * into v_market from public.markets where id = p_market_id;
  if v_market.id is null then
    raise exception 'Market not found';
  end if;

  if v_market.status <> 'open' then
    raise exception 'Market is not open';
  end if;

  -- Check permissions (admin, creator, or group admin)
  select is_admin into v_is_admin from public.users where id = v_user_id;
  v_is_creator := (v_market.creator_id = v_user_id);
  
  if v_market.group_id is not null then
    select (role = 'admin') into v_is_group_admin 
    from public.group_members 
    where group_id = v_market.group_id and user_id = v_user_id;
  end if;

  if not (v_is_admin or v_is_creator or v_is_group_admin) then
    raise exception 'Not authorized to resolve this market';
  end if;

  -- Get winning option label
  select label into v_option_label from public.options where id = p_winning_option_id;

  -- Calculate pools (combine yes_pool + no_pool for each option)
  select coalesce(sum(yes_pool + no_pool), 0) into v_total_pool
  from public.options where market_id = p_market_id;

  select coalesce(yes_pool + no_pool, 0) into v_winning_pool
  from public.options where id = p_winning_option_id;

  v_losing_pool := v_total_pool - v_winning_pool;

  -- Calculate vig from losing pool only
  v_vig_amount := v_losing_pool * p_vig_percent;
  v_net_pool := v_total_pool - v_vig_amount;

  -- Update market status
  update public.markets
  set status = 'resolved',
      winning_option_id = p_winning_option_id,
      resolved_at = now(),
      updated_at = now()
  where id = p_market_id;

  -- Process payouts for winning bets
  for v_bet in 
    select b.*, w.user_id as wallet_user_id
    from public.bets b
    join public.wallets w on w.user_id = b.user_id
    where b.market_id = p_market_id
    and b.option_id = p_winning_option_id
    and b.side = 'yes'
  loop
    -- Calculate proportional payout from net pool
    if v_winning_pool > 0 then
      v_payout := (v_bet.amount / v_winning_pool) * v_net_pool;
    else
      v_payout := v_bet.amount; -- Fallback: return original bet
    end if;

    -- Pay out to correct balance based on bet's is_play_mode
    if v_bet.is_play_mode then
      update public.wallets
      set play_balance = play_balance + v_payout,
          updated_at = now()
      where user_id = v_bet.user_id;
    else
      update public.wallets
      set balance = balance + v_payout,
          updated_at = now()
      where user_id = v_bet.user_id;
    end if;

    -- Log winning transaction
    insert into public.transactions (user_id, amount, type, status, is_play_mode, metadata)
    values (
      v_bet.user_id,
      v_payout,
      'bet_won',
      'completed',
      v_bet.is_play_mode,
      jsonb_build_object(
        'market_question', v_market.question,
        'option_label', v_option_label,
        'bet_id', v_bet.id,
        'market_id', p_market_id,
        'wager', v_bet.amount,
        'is_play_mode', v_bet.is_play_mode
      )
    );
  end loop;

  -- Log losing bets (for history)
  for v_bet in
    select b.*
    from public.bets b
    where b.market_id = p_market_id
    and (b.option_id <> p_winning_option_id or b.side = 'no')
  loop
    insert into public.transactions (user_id, amount, type, status, is_play_mode, metadata)
    values (
      v_bet.user_id,
      0,
      'bet_lost',
      'completed',
      v_bet.is_play_mode,
      jsonb_build_object(
        'market_question', v_market.question,
        'option_label', v_option_label,
        'bet_id', v_bet.id,
        'market_id', p_market_id,
        'wager', v_bet.amount,
        'is_play_mode', v_bet.is_play_mode
      )
    );
  end loop;
end;
$function$;

-- ============================================================================
-- 8. GRANT EXECUTE PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.refresh_play_credits() TO authenticated;
