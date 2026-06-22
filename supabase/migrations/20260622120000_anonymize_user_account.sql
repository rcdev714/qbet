begin;

create or replace function public.check_user_can_delete_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric;
  v_pending_payouts integer;
begin
  if p_user_id is null then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'not_authenticated',
      'message', 'You must be signed in to delete your account.'
    );
  end if;

  if not exists (select 1 from public.users u where u.id = p_user_id) then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'user_not_found',
      'message', 'Account not found.'
    );
  end if;

  select coalesce(w.balance, 0)
  into v_balance
  from public.wallets w
  where w.user_id = p_user_id
  limit 1;

  if coalesce(v_balance, 0) > 0 then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'non_zero_balance',
      'message', 'Withdraw or transfer your live wallet balance before deleting your account.'
    );
  end if;

  select count(*)
  into v_pending_payouts
  from public.payout_requests pr
  where pr.user_id = p_user_id
    and coalesce(pr.status, 'pending') in ('pending', 'processing', 'requested');

  if v_pending_payouts > 0 then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'pending_payout',
      'message', 'You have a pending withdrawal. Wait for it to finish before deleting your account.'
    );
  end if;

  return jsonb_build_object('allowed', true);
end;
$$;

create or replace function public.anonymize_user_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_short_id text := substring(replace(p_user_id::text, '-', ''), 1, 8);
  v_deleted_email text := 'deleted+' || p_user_id::text || '@anymarket.invalid';
  v_deleted_username text := 'deleted_' || v_short_id;
  v_group record;
  v_new_admin uuid;
begin
  if p_user_id is null then
    raise exception 'User id is required';
  end if;

  for v_group in
    select g.id
    from public.groups g
    where g.admin_id = p_user_id
  loop
    select gm.user_id
    into v_new_admin
    from public.group_members gm
    where gm.group_id = v_group.id
      and gm.user_id <> p_user_id
    order by gm.joined_at asc
    limit 1;

    if v_new_admin is not null then
      update public.groups
      set admin_id = v_new_admin
      where id = v_group.id;
    end if;
  end loop;

  delete from public.user_follows
  where follower_id = p_user_id or following_id = p_user_id;

  delete from public.notifications where user_id = p_user_id;
  delete from public.user_engagement where user_id = p_user_id;
  delete from public.user_compliance_profiles where user_id = p_user_id;
  delete from public.user_policy_acceptances where user_id = p_user_id;
  delete from public.kyc_verification_sessions where user_id = p_user_id;
  delete from public.payment_provider_accounts where user_id = p_user_id;
  delete from public.category_follows where user_id = p_user_id;
  delete from public.market_likes where user_id = p_user_id;
  delete from public.user_stats where user_id = p_user_id;
  delete from public.group_members where user_id = p_user_id;
  delete from public.invites where created_by = p_user_id and coalesce(used, false) is not true;

  update public.wallets
  set
    balance = 0,
    play_balance = 0,
    paypal_email = null,
    stripe_account_id = null,
    stripe_customer_id = null,
    global_recipient_id = null,
    payout_method_id = null,
    country = null,
    updated_at = now()
  where user_id = p_user_id;

  update public.users
  set
    email = v_deleted_email,
    username = v_deleted_username,
    avatar_url = null,
    stripe_customer_id = null,
    is_admin = false
  where id = p_user_id;
end;
$$;

grant execute on function public.check_user_can_delete_account(uuid) to authenticated, service_role;
grant execute on function public.anonymize_user_account(uuid) to service_role;

commit;
