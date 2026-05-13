CREATE OR REPLACE FUNCTION public.resolve_market(p_market_id uuid, p_winning_option_id uuid)
 RETURNS markets
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_market public.markets;
  v_total_pool numeric;
  v_winning_pool numeric;
  v_bet record;
  v_pool_after_vig numeric;
  c_vig numeric := 0.0795; -- 7.95% House Edge applied to the total pool (3.2% Card + 1.75% Transfer + 3% Service)
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- 1. Get and lock the market
  select * into v_market from public.markets m where m.id = p_market_id for update;
  if v_market.id is null then
    raise exception 'Market not found';
  end if;

  -- 2. Verify admin rights (Only users with 'admin' role in group_members can resolve)
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

  -- 3. Calculate total pool and winning pool
  select sum(total_pool) into v_total_pool from public.options where market_id = p_market_id;
  select total_pool into v_winning_pool from public.options where id = p_winning_option_id;

  -- 4. If there were no bets on anything, just close it
  if v_total_pool = 0 or v_total_pool is null then
    update public.markets
    set status = 'resolved', resolved_at = now(), winning_option_id = p_winning_option_id
    where id = p_market_id
    returning * into v_market;
    return v_market;
  end if;

  -- 5. Distribute payouts to winners
  if v_winning_pool > 0 then
    -- Apply Vig to the total pool
    v_pool_after_vig := v_total_pool * (1 - c_vig);

    for v_bet in 
      select b.id, b.user_id, b.amount, b.option_id, o.label as option_label, m.question as market_question
      from public.bets b
      join public.options o on b.option_id = o.id
      join public.markets m on b.market_id = m.id
      where b.market_id = p_market_id
    loop
      -- Calculate payout amount (default 0)
      declare
        v_payout_amount numeric := 0;
        v_type text := 'bet_lost';
      begin
        if v_bet.option_id = p_winning_option_id then
           v_payout_amount := (v_bet.amount / v_winning_pool) * v_pool_after_vig;
           v_type := 'bet_won';
           
           update public.wallets
           set balance = balance + v_payout_amount
           where user_id = v_bet.user_id;
        end if;

        -- Log transaction (record wins AND losses)
        -- For losses, amount is 0 (or we could show negative bet amount, but that was already deducted when placed. 
        -- Sticking to 0 for "payout" on loss, but type indicates loss.)
        insert into public.transactions (user_id, amount, type, status, metadata)
        values (
          v_bet.user_id, 
          v_payout_amount, 
          v_type, 
          'completed', 
          jsonb_build_object(
            'market_question', v_bet.market_question,
            'option_label', v_bet.option_label,
            'bet_id', v_bet.id,
            'wager', v_bet.amount
          )
        );
      end;
    end loop;
  end if;

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
