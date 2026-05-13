-- Update resolve_market to handle YES/NO pools (group markets)
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

          insert into public.transactions (user_id, amount, type, status, metadata)
          values (
            v_bet.user_id,
            v_payout_amount,
            v_type,
            'completed',
            jsonb_build_object(
              'market_question', v_market.question,
              'option_label', v_option.label,
              'bet_id', v_bet.id,
              'wager', v_bet.amount,
              'side', v_bet.side,
              'market_type', 'private'
            )
          );
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

-- Update resolve_public_market to handle YES/NO pools (public markets)
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

          insert into public.transactions (user_id, amount, type, status, metadata)
          values (
            v_bet.user_id,
            v_payout_amount,
            v_type,
            'completed',
            jsonb_build_object(
              'market_question', v_market.question,
              'option_label', v_option.label,
              'bet_id', v_bet.id,
              'wager', v_bet.amount,
              'side', v_bet.side,
              'market_type', 'public'
            )
          );
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
