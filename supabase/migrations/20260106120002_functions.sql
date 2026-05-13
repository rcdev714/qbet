-- Functions
CREATE OR REPLACE FUNCTION public.is_group_admin(p_group_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_user_id
      and gm.role = 'admin'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists(
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = p_user_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_group_share_code(p_group_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not public.is_group_admin(p_group_id, auth.uid()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select g.share_code
    into v_code
  from public.groups g
  where g.id = p_group_id;

  return v_code;
end;
$function$;

CREATE OR REPLACE FUNCTION public.remove_group_member(p_group_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not public.is_group_admin(p_group_id, auth.uid()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Admins cannot remove themselves' using errcode = '22023';
  end if;

  if public.is_group_admin(p_group_id, p_user_id) then
    raise exception 'Cannot remove another admin' using errcode = '22023';
  end if;

  delete from public.group_members gm
  where gm.group_id = p_group_id
    and gm.user_id = p_user_id;

  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.delete_group(p_group_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_active_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not public.is_group_admin(p_group_id, auth.uid()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select count(*)
    into v_active_count
  from public.markets m
  where m.group_id = p_group_id
    and m.status not in ('resolved', 'cancelled');

  if v_active_count > 0 then
    raise exception 'Cannot delete group while predictions are active. Resolve or cancel all predictions first.' using errcode = '22023';
  end if;

  -- Bets (via markets)
  delete from public.bets b
  using public.markets m
  where b.market_id = m.id
      and m.group_id = p_group_id;

  -- Options (via markets)
  delete from public.options o
  using public.markets m
  where o.market_id = m.id
      and m.group_id = p_group_id;

  -- Messages
  delete from public.messages
  where group_id = p_group_id;

  -- Invites
  delete from public.invites
  where group_id = p_group_id;

  -- Markets
  delete from public.markets
  where group_id = p_group_id;

  -- Memberships
  delete from public.group_members
  where group_id = p_group_id;

  -- Group
  delete from public.groups
  where id = p_group_id;

  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.join_group_by_code(p_code text)
 RETURNS group_members
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_group_id UUID;
  v_membership public.group_members;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Ensure the user exists in the public.users table (lazy creation if trigger failed)
  INSERT INTO public.users (id) 
  VALUES (v_user_id) 
  ON CONFLICT (id) DO NOTHING;

  -- Ensure the user has a wallet
  INSERT INTO public.wallets (user_id, balance)
  VALUES (v_user_id, 1000)
  ON CONFLICT (user_id) DO NOTHING;

  -- Find the group (RLS is bypassed because of SECURITY DEFINER)
  SELECT id INTO v_group_id FROM public.groups WHERE UPPER(share_code) = UPPER(TRIM(p_code));
  
  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Group not found';
  END IF;

  -- Join the group
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (v_group_id, v_user_id, 'member')
  ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role
  RETURNING * INTO v_membership;

  RETURN v_membership;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_group_code()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Removed confusing chars like 0, O, I, 1
  result TEXT := '';
  i INTEGER := 0;
BEGIN
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_generate_group_code_fn()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.share_code IS NULL THEN
    LOOP
      NEW.share_code := generate_group_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.groups WHERE share_code = NEW.share_code);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

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
  if v_total_pool = 0 then
    update public.markets
    set status = 'resolved', resolved_at = now(), winning_option_id = p_winning_option_id
    where id = p_market_id
    returning * into v_market;
    return v_market;
  end if;

  -- 5. Distribute payouts to winners
  if v_winning_pool > 0 then
    for v_bet in 
      select user_id, amount from public.bets 
      where market_id = p_market_id and option_id = p_winning_option_id
    loop
      update public.wallets
      set balance = balance + ((v_bet.amount / v_winning_pool) * v_total_pool)
      where user_id = v_bet.user_id;
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

CREATE OR REPLACE FUNCTION public.place_bet(p_market_id uuid, p_option_id uuid, p_amount numeric)
 RETURNS bets
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_market public.markets;
  v_wallet public.wallets;
  v_bet public.bets;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
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

  if not public.is_group_member(v_market.group_id, v_user_id) then
    raise exception 'Not a member of this group';
  end if;

  select * into v_wallet from public.wallets w where w.user_id = v_user_id for update;
  if v_wallet.id is null then
    raise exception 'Wallet not found';
  end if;

  if v_wallet.balance < p_amount then
    raise exception 'Insufficient balance';
  end if;

  update public.wallets
  set balance = balance - p_amount
  where user_id = v_user_id;

  insert into public.bets(user_id, market_id, option_id, amount)
  values (v_user_id, p_market_id, p_option_id, p_amount)
  returning * into v_bet;

  return v_bet;
end;
$function$;

CREATE OR REPLACE FUNCTION public.accept_invite(p_code text)
 RETURNS group_members
 LANGUAGE plpgsql
 SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION public.add_funds(p_user_id uuid, p_amount numeric, p_reference_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Update wallet balance
    UPDATE public.wallets
    SET balance = balance + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id;

    -- Log transaction
    INSERT INTO public.transactions (user_id, amount, type, status, reference_id)
    VALUES (p_user_id, p_amount, 'deposit', 'completed', p_reference_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.users(id, email, username, avatar_url)
  values (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'username', 
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set 
    email = excluded.email,
    username = coalesce(excluded.username, users.username),
    avatar_url = coalesce(excluded.avatar_url, users.avatar_url);

  insert into public.wallets(user_id, balance, currency, is_virtual)
  values (new.id, 1000, 'USD', true)
  on conflict (user_id) do nothing;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_bet_option_matches_market()
 RETURNS trigger
 LANGUAGE plpgsql
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

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.bump_option_pool_on_bet_insert()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  update public.options
  set total_pool = total_pool + new.amount
  where id = new.option_id;
  return new;
end;
$function$;
