-- Fix: Set explicit search_path on all functions to prevent search_path hijacking
-- This addresses the "function_search_path_mutable" security warnings

-- 1. is_group_admin
CREATE OR REPLACE FUNCTION public.is_group_admin(p_group_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = 'public'
AS $function$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_user_id
      and gm.role = 'admin'
  );
$function$;

-- 2. is_group_member
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = 'public'
AS $function$
  select exists(
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = p_user_id
  );
$function$;

-- 3. set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- 4. generate_group_code
CREATE OR REPLACE FUNCTION public.generate_group_code()
RETURNS text
LANGUAGE sql
SET search_path = 'public'
AS $function$
  SELECT UPPER(LPAD(TO_HEX(FLOOR(RANDOM() * 16777215)::INT), 6, '0'));
$function$;

-- 5. trg_generate_group_code_fn
CREATE OR REPLACE FUNCTION public.trg_generate_group_code_fn()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.share_code IS NULL THEN
    LOOP
      NEW.share_code := public.generate_group_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.groups WHERE share_code = NEW.share_code);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

-- 6. ensure_bet_option_matches_market
CREATE OR REPLACE FUNCTION public.ensure_bet_option_matches_market()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
declare
  opt_market_id uuid;
begin
  select o.market_id into opt_market_id from public.options o where o.id = new.option_id;
  if opt_market_id is null then
    raise exception 'Option does not exist';
  end if;
  if opt_market_id <> new.market_id then
    raise exception 'Option does not belong to market';
  end if;
  return new;
end;
$function$;

-- 7. bump_option_pool_on_bet_insert
CREATE OR REPLACE FUNCTION public.bump_option_pool_on_bet_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
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

-- 8. auto_admin_grant
CREATE OR REPLACE FUNCTION public.auto_admin_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.email = 'juan.salgador@uisek.edu.ec' THEN
    NEW.is_admin := TRUE;
  END IF;
  RETURN NEW;
END;
$function$;

-- 9. handle_bet_placed_notification
CREATE OR REPLACE FUNCTION public.handle_bet_placed_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    v_option_label text;
    v_is_public_market boolean;
BEGIN
    -- Check if it's a public market
    SELECT is_public INTO v_is_public_market 
    FROM public.markets 
    WHERE id = NEW.market_id;

    -- Only proceed for public markets
    IF v_is_public_market THEN
        -- Get the option label
        SELECT label INTO v_option_label 
        FROM public.options 
        WHERE id = NEW.option_id;

        -- Insert the notification message
        INSERT INTO public.market_chat_messages (market_id, user_id, content)
        VALUES (
            NEW.market_id, 
            NEW.user_id, 
            'bet $' || trim(to_char(NEW.amount, '9999999990.00')) || ' on ' || v_option_label
        );
    END IF;

    RETURN NEW;
END;
$function$;

-- 10. upsert_engagement
CREATE OR REPLACE FUNCTION public.upsert_engagement(
    p_user_id UUID,
    p_market_id UUID,
    p_category TEXT,
    p_duration_ms INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
    INSERT INTO public.user_engagement (user_id, market_id, category, views, view_duration_ms)
    VALUES (p_user_id, p_market_id, p_category, 1, p_duration_ms)
    ON CONFLICT (user_id, market_id)
    DO UPDATE SET
        views = public.user_engagement.views + 1,
        view_duration_ms = public.user_engagement.view_duration_ms + EXCLUDED.view_duration_ms,
        updated_at = NOW();
END;
$function$;

-- 11. accept_invite
CREATE OR REPLACE FUNCTION public.accept_invite(p_code text)
RETURNS public.group_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_invite public.invites;
  v_membership public.group_members;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invite
  from public.invites i
  where i.code = p_code;

  if v_invite.id is null then
    raise exception 'Invite not found';
  end if;

  if v_invite.used then
    raise exception 'Invite already used';
  end if;

  if v_invite.expires_at is not null and now() > v_invite.expires_at then
    raise exception 'Invite expired';
  end if;

  insert into public.group_members(group_id, user_id, role)
  values (v_invite.group_id, v_user_id, 'member')
  on conflict (group_id, user_id) do update set role = excluded.role
  returning * into v_membership;

  update public.invites
  set used = true,
      used_by = v_user_id,
      used_at = now()
  where id = v_invite.id;

  return v_membership;
end;
$function$;

-- 12. place_bet (4-param version with side)
CREATE OR REPLACE FUNCTION public.place_bet(
  p_market_id uuid,
  p_option_id uuid,
  p_amount numeric,
  p_side text DEFAULT 'yes'
)
RETURNS public.bets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

-- 13. resolve_market (group markets)
CREATE OR REPLACE FUNCTION public.resolve_market(p_market_id uuid, p_winning_option_id uuid)
RETURNS public.markets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

-- 14. resolve_public_market (public markets)
CREATE OR REPLACE FUNCTION public.resolve_public_market(p_market_id uuid, p_winning_option_id uuid)
RETURNS public.markets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

-- 15. toggle_market_like
CREATE OR REPLACE FUNCTION public.toggle_market_like(p_market_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_exists BOOLEAN;
    v_new_count BIGINT;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    -- Check if like exists
    SELECT EXISTS(
        SELECT 1 FROM public.market_likes 
        WHERE user_id = v_user_id AND market_id = p_market_id
    ) INTO v_exists;
    
    IF v_exists THEN
        -- Unlike
        DELETE FROM public.market_likes 
        WHERE user_id = v_user_id AND market_id = p_market_id;
    ELSE
        -- Like
        INSERT INTO public.market_likes (user_id, market_id)
        VALUES (v_user_id, p_market_id);
    END IF;
    
    -- Get new count
    SELECT COUNT(*) INTO v_new_count
    FROM public.market_likes WHERE market_id = p_market_id;
    
    RETURN jsonb_build_object(
        'liked', NOT v_exists,
        'count', v_new_count
    );
END;
$function$;

-- 16. get_market_social_stats
CREATE OR REPLACE FUNCTION public.get_market_social_stats(p_market_id UUID)
RETURNS TABLE (
    like_count BIGINT,
    share_count BIGINT,
    comment_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM public.market_likes WHERE market_id = p_market_id) AS like_count,
        (SELECT COUNT(*) FROM public.market_shares WHERE market_id = p_market_id) AS share_count,
        (SELECT COUNT(*) FROM public.market_chat_messages WHERE market_id = p_market_id) AS comment_count;
END;
$function$;

-- 17. generate_share_code
CREATE OR REPLACE FUNCTION public.generate_share_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
DECLARE
    v_code TEXT;
    v_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate 8-character alphanumeric code
        v_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
        
        -- Check if it exists
        SELECT EXISTS(
            SELECT 1 FROM public.market_shares WHERE share_code = v_code
        ) INTO v_exists;
        
        EXIT WHEN NOT v_exists;
    END LOOP;
    
    RETURN v_code;
END;
$function$;

-- 18. track_market_share
CREATE OR REPLACE FUNCTION public.track_market_share(
    p_market_id UUID,
    p_platform TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    v_share_code TEXT;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid(); -- Can be NULL for anonymous
    v_share_code := public.generate_share_code();
    
    INSERT INTO public.market_shares (user_id, market_id, share_code, platform)
    VALUES (v_user_id, p_market_id, v_share_code, p_platform);
    
    RETURN v_share_code;
END;
$function$;
