-- Update trigger to handle YES/NO pools
CREATE OR REPLACE FUNCTION public.bump_option_pool_on_bet_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
begin
  if new.side = 'no' then
    update public.options
    set no_pool = no_pool + new.amount,
        total_pool = total_pool + new.amount
    where id = new.option_id;
  else
    update public.options
    set yes_pool = yes_pool + new.amount,
        total_pool = total_pool + new.amount
    where id = new.option_id;
  end if;

  return new;
end;
$function$;

-- Update place_bet to accept YES/NO side
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

  -- Log transaction
  insert into public.transactions (user_id, amount, type, status, metadata)
  values (
    v_user_id, 
    -p_amount, 
    'bet_placed', 
    'completed', 
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
