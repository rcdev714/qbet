begin;

-- ============================================================================
-- Phase 1: Security boundary hardening
-- Deny direct client writes on financial / market-structure tables.
-- Lock down legacy privileged functions and trust-sensitive RPCs.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Bets: RPC-only inserts (place_bet)
-- ---------------------------------------------------------------------------
drop policy if exists "Users can place bets" on public.bets;

create policy "bets_insert_none"
  on public.bets
  for insert
  to authenticated, anon
  with check (false);

-- ---------------------------------------------------------------------------
-- Options: RPC-only inserts (market creation flows)
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated users can create options" on public.options;

create policy "options_insert_none"
  on public.options
  for insert
  to authenticated, anon
  with check (false);

-- ---------------------------------------------------------------------------
-- Wallets: signup trigger owns creation; clients cannot seed balances
-- ---------------------------------------------------------------------------
drop policy if exists "Users can create their own wallet" on public.wallets;
drop policy if exists "wallets_insert_own" on public.wallets;

create policy "wallets_insert_zero_balance"
  on public.wallets
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and coalesce(balance, 0) = 0
    and coalesce(play_balance, 1000) <= 1000
    and coalesce(is_virtual, true) = true
  );

-- ---------------------------------------------------------------------------
-- Legacy add_funds: remove client execution path
-- ---------------------------------------------------------------------------
revoke all on function public.add_funds(uuid, numeric, text) from public, anon, authenticated;

drop function if exists public.add_funds(uuid, numeric, text);

-- ---------------------------------------------------------------------------
-- Compliance events: service-role only (gate + provider paths)
-- ---------------------------------------------------------------------------
revoke all on function public.record_compliance_event(
  uuid, text, text, text, text, jsonb, text, text, uuid, uuid
) from authenticated;

-- ---------------------------------------------------------------------------
-- Beta access lookup: authenticated + own email only
-- ---------------------------------------------------------------------------
create or replace function public.get_beta_access_request_by_email(
  p_email text
)
returns public.beta_access_requests
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_auth_email text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select lower(trim(coalesce(u.email, '')))
  into v_auth_email
  from public.users u
  where u.id = v_user_id;

  if v_email = '' or v_auth_email = '' or v_email <> v_auth_email then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  return (
    select bar.*
    from public.beta_access_requests bar
    where bar.email = v_email
    order by bar.created_at desc
    limit 1
  );
end;
$$;

revoke all on function public.get_beta_access_request_by_email(text) from public, anon;
grant execute on function public.get_beta_access_request_by_email(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Wallet recipient lookup: mask email in responses
-- ---------------------------------------------------------------------------
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
  v_email text;
  v_local text;
  v_domain text;
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
    case
      when u.email is null or u.email = '' then null
      when position('@' in u.email) = 0 then u.email
      else
        left(split_part(u.email, '@', 1), 1)
        || '***@'
        || split_part(u.email, '@', 2)
    end as email
  from public.users u
  where u.id <> v_caller_id
    and (
      lower(coalesce(u.username, '')) = v_query
      or lower(coalesce(u.email, '')) = v_query
    )
  limit 1;
end;
$$;

commit;
