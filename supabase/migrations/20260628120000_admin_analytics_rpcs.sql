-- Admin analytics RPCs: cross-user financial reads guarded by is_app_admin().

create or replace function public.get_admin_financial_kpis()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.is_app_admin(auth.uid()) is not true then
    raise exception 'Admin only';
  end if;

  return jsonb_build_object(
    'total_deposits',
      coalesce((
        select sum(amount)
        from public.transactions
        where type = 'deposit'
          and status = 'completed'
          and coalesce(is_play_mode, false) = false
      ), 0),
    'total_withdrawals',
      coalesce((
        select sum(amount)
        from public.transactions
        where type = 'withdrawal'
          and status = 'completed'
          and coalesce(is_play_mode, false) = false
      ), 0),
    'wallet_float',
      coalesce((select sum(balance) from public.wallets), 0),
    'open_reports',
      coalesce((
        select count(*)
        from public.content_reports
        where status = 'open'
      ), 0)
  );
end;
$$;

create or replace function public.get_admin_daily_financial_series(p_days int default 14)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start date := (current_date - greatest(p_days, 1));
  v_dates date[];
  v_deposits numeric[];
  v_withdrawals numeric[];
  v_bet_volume numeric[];
  v_day date;
  v_i int := 0;
begin
  if public.is_app_admin(auth.uid()) is not true then
    raise exception 'Admin only';
  end if;

  v_dates := array[]::date[];
  v_deposits := array[]::numeric[];
  v_withdrawals := array[]::numeric[];
  v_bet_volume := array[]::numeric[];

  for v_day in
    select generate_series(v_start, current_date, interval '1 day')::date
  loop
    v_i := v_i + 1;
    v_dates[v_i] := v_day;
    v_deposits[v_i] := coalesce((
      select sum(amount)
      from public.transactions
      where type = 'deposit'
        and status = 'completed'
        and coalesce(is_play_mode, false) = false
        and created_at >= v_day
        and created_at < v_day + interval '1 day'
    ), 0);
    v_withdrawals[v_i] := coalesce((
      select sum(amount)
      from public.transactions
      where type = 'withdrawal'
        and status = 'completed'
        and coalesce(is_play_mode, false) = false
        and created_at >= v_day
        and created_at < v_day + interval '1 day'
    ), 0);
    v_bet_volume[v_i] := coalesce((
      select sum(amount)
      from public.bets
      where coalesce(is_play_mode, false) = false
        and placed_at >= v_day
        and placed_at < v_day + interval '1 day'
    ), 0);
  end loop;

  return jsonb_build_object(
    'dates', to_jsonb(v_dates),
    'deposits', to_jsonb(v_deposits),
    'withdrawals', to_jsonb(v_withdrawals),
    'bet_volume', to_jsonb(v_bet_volume)
  );
end;
$$;

create or replace function public.list_admin_transactions(
  p_limit int default 50,
  p_offset int default 0,
  p_type text default null,
  p_status text default null,
  p_is_play_mode boolean default null,
  p_search text default null
)
returns table (
  id uuid,
  user_id uuid,
  username text,
  amount numeric,
  type text,
  status text,
  reference_id text,
  is_play_mode boolean,
  metadata jsonb,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.is_app_admin(auth.uid()) is not true then
    raise exception 'Admin only';
  end if;

  return query
  with filtered as (
    select
      t.id,
      t.user_id,
      u.username,
      t.amount,
      t.type,
      t.status,
      t.reference_id,
      t.is_play_mode,
      t.metadata,
      t.created_at
    from public.transactions t
    left join public.users u on u.id = t.user_id
    where (p_type is null or t.type = p_type)
      and (p_status is null or t.status = p_status)
      and (p_is_play_mode is null or coalesce(t.is_play_mode, false) = p_is_play_mode)
      and (
        p_search is null
        or btrim(p_search) = ''
        or u.username ilike '%' || btrim(p_search) || '%'
        or coalesce(t.reference_id, '') ilike '%' || btrim(p_search) || '%'
        or t.id::text ilike '%' || btrim(p_search) || '%'
      )
  ),
  counted as (
    select count(*)::bigint as cnt from filtered
  )
  select
    f.id,
    f.user_id,
    f.username,
    f.amount,
    f.type,
    f.status,
    f.reference_id,
    f.is_play_mode,
    f.metadata,
    f.created_at,
    c.cnt
  from filtered f
  cross join counted c
  order by f.created_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$$;

create or replace function public.list_admin_content_reports(
  p_status text default null,
  p_limit int default 100,
  p_offset int default 0
)
returns table (
  id uuid,
  reporter_id uuid,
  reporter_username text,
  target_type text,
  target_id text,
  target_user_id uuid,
  target_username text,
  reason text,
  details text,
  status text,
  admin_notes text,
  created_at timestamptz,
  resolved_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.is_app_admin(auth.uid()) is not true then
    raise exception 'Admin only';
  end if;

  return query
  with filtered as (
    select
      cr.id,
      cr.reporter_id,
      ru.username as reporter_username,
      cr.target_type,
      cr.target_id,
      cr.target_user_id,
      tu.username as target_username,
      cr.reason,
      cr.details,
      cr.status,
      cr.admin_notes,
      cr.created_at,
      cr.resolved_at
    from public.content_reports cr
    left join public.users ru on ru.id = cr.reporter_id
    left join public.users tu on tu.id = cr.target_user_id
    where p_status is null or cr.status = p_status
  ),
  counted as (
    select count(*)::bigint as cnt from filtered
  )
  select
    f.id,
    f.reporter_id,
    f.reporter_username,
    f.target_type,
    f.target_id,
    f.target_user_id,
    f.target_username,
    f.reason,
    f.details,
    f.status,
    f.admin_notes,
    f.created_at,
    f.resolved_at,
    c.cnt
  from filtered f
  cross join counted c
  order by f.created_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$$;

grant execute on function public.get_admin_financial_kpis() to authenticated;
grant execute on function public.get_admin_daily_financial_series(int) to authenticated;
grant execute on function public.list_admin_transactions(int, int, text, text, boolean, text) to authenticated;
grant execute on function public.list_admin_content_reports(text, int, int) to authenticated;
