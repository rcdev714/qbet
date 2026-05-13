-- ============================================================================
-- FIX INITIAL WALLET BALANCE
-- New users should have 0 real balance. Play balance (1000) is set by default.
-- ============================================================================

-- 1. Fix handle_new_auth_user trigger to create wallet with 0 balance
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

  -- Create wallet with 0 real balance (play_balance defaults to 1000 via column default)
  insert into public.wallets(user_id, balance, currency, is_virtual)
  values (new.id, 0, 'USD', true)
  on conflict (user_id) do nothing;

  return new;
end;
$function$;

-- 2. Fix join_group_by_code function to create wallet with 0 balance
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

  -- Ensure the user has a wallet with 0 real balance (play_balance defaults to 1000)
  INSERT INTO public.wallets (user_id, balance)
  VALUES (v_user_id, 0)
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
