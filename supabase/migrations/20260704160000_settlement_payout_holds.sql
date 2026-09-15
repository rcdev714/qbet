-- Pending settlement payouts for live private group markets (72h hold)

begin;

-- ============================================================================
-- Schema
-- ============================================================================

alter table public.markets
  add column if not exists payout_release_at timestamptz,
  add column if not exists payout_status text not null default 'none'
    check (payout_status in ('none', 'pending_release', 'held', 'released', 'voided'));

create table if not exists public.settlement_payout_holds (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  bet_id uuid not null references public.bets(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'released', 'cancelled', 'superseded')),
  releases_at timestamptz not null,
  released_at timestamptz,
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bet_id)
);

create index if not exists idx_settlement_payout_holds_user_pending
  on public.settlement_payout_holds(user_id, status)
  where status = 'pending';

create index if not exists idx_settlement_payout_holds_market
  on public.settlement_payout_holds(market_id);

create index if not exists idx_markets_payout_release_due
  on public.markets(payout_release_at)
  where payout_status = 'pending_release';

alter table public.settlement_payout_holds enable row level security;

drop policy if exists "Users read own settlement payout holds" on public.settlement_payout_holds;
create policy "Users read own settlement payout holds"
  on public.settlement_payout_holds for select to authenticated
  using (user_id = (select auth.uid()));

-- ============================================================================
-- release_market_payouts
-- ============================================================================

create or replace function public.release_market_payouts(
  p_market_id uuid,
  p_force boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_app_admin boolean := false;
  v_market public.markets;
  v_hold record;
  v_released int := 0;
  v_tx_id uuid;
begin
  select * into v_market from public.markets where id = p_market_id for update;
  if v_market.id is null then
    raise exception 'Market not found';
  end if;

  if v_user_id is not null then
    select coalesce(is_admin, false) into v_is_app_admin
    from public.users where id = v_user_id;
  end if;

  if v_market.payout_status not in ('pending_release', 'held') then
    return 0;
  end if;

  if v_market.settlement_override_status in ('challenged', 'frozen') and not p_force then
    return 0;
  end if;

  if not p_force
    and v_market.payout_status = 'pending_release'
    and v_market.payout_release_at is not null
    and v_market.payout_release_at > now()
  then
    return 0;
  end if;

  if p_force and v_user_id is not null and not v_is_app_admin then
    raise exception 'Only platform admins may force release';
  end if;

  for v_hold in
    select * from public.settlement_payout_holds
    where market_id = p_market_id and status = 'pending'
    for update
  loop
    update public.wallets
    set balance = balance + v_hold.amount,
        updated_at = now()
    where user_id = v_hold.user_id;

    if v_hold.transaction_id is not null then
      update public.transactions
      set status = 'completed',
          metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('released_at', now())
      where id = v_hold.transaction_id;
      v_tx_id := v_hold.transaction_id;
    else
      insert into public.transactions (user_id, amount, type, status, is_play_mode, metadata)
      values (
        v_hold.user_id,
        v_hold.amount,
        'bet_won',
        'completed',
        false,
        jsonb_build_object(
          'market_id', p_market_id,
          'bet_id', v_hold.bet_id,
          'pending_settlement', false,
          'released_at', now()
        )
      )
      returning id into v_tx_id;
    end if;

    update public.settlement_payout_holds
    set status = 'released',
        released_at = now(),
        transaction_id = coalesce(transaction_id, v_tx_id)
    where id = v_hold.id;

    v_released := v_released + 1;
  end loop;

  if v_released > 0 or v_market.payout_status in ('pending_release', 'held') then
    update public.markets
    set payout_status = 'released',
        settlement_override_status = case
          when settlement_override_status in ('challenged', 'frozen') and p_force then 'none'
          else settlement_override_status
        end
    where id = p_market_id;
  end if;

  return v_released;
end;
$$;

-- ============================================================================
-- release_due_settlement_payouts (cron)
-- ============================================================================

create or replace function public.release_due_settlement_payouts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market_id uuid;
  v_total int := 0;
  v_count int;
begin
  for v_market_id in
    select id from public.markets
    where payout_status = 'pending_release'
      and payout_release_at is not null
      and payout_release_at <= now()
      and settlement_override_status not in ('challenged', 'frozen')
  loop
    v_count := public.release_market_payouts(v_market_id, false);
    v_total := v_total + v_count;
  end loop;

  return v_total;
end;
$$;

-- ============================================================================
-- hold_market_payouts
-- ============================================================================

create or replace function public.hold_market_payouts(p_market_id uuid)
returns public.markets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market public.markets;
begin
  update public.markets
  set payout_status = 'held'
  where id = p_market_id
    and payout_status in ('pending_release', 'held')
  returning * into v_market;

  return v_market;
end;
$$;

-- ============================================================================
-- get_pending_settlement_payouts
-- ============================================================================

create or replace function public.get_pending_settlement_payouts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_items jsonb := '[]'::jsonb;
  v_total numeric := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select
    coalesce(sum(h.amount), 0),
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', h.id,
        'market_id', h.market_id,
        'market_question', m.question,
        'amount', h.amount,
        'releases_at', h.releases_at
      )
      order by h.releases_at asc
    ), '[]'::jsonb)
  into v_total, v_items
  from public.settlement_payout_holds h
  join public.markets m on m.id = h.market_id
  where h.user_id = v_user_id
    and h.status = 'pending';

  return jsonb_build_object(
    'total', v_total,
    'items', v_items
  );
end;
$$;

-- ============================================================================
-- platform_review_settlement
-- ============================================================================

create or replace function public.platform_review_settlement(
  p_market_id uuid,
  p_decision text
)
returns public.markets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_app_admin boolean;
  v_market public.markets;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(is_admin, false) into v_is_app_admin
  from public.users where id = v_user_id;

  if not v_is_app_admin then
    raise exception 'Only platform admins may review settlements';
  end if;

  if p_decision not in ('uphold', 'void', 'correct') then
    raise exception 'Invalid decision';
  end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if v_market.id is null then
    raise exception 'Market not found';
  end if;

  if p_decision = 'uphold' then
    perform public.release_market_payouts(p_market_id, true);
    update public.markets
    set settlement_override_status = 'none'
    where id = p_market_id
    returning * into v_market;
    return v_market;
  end if;

  if p_decision = 'void' then
    update public.transactions
    set status = 'cancelled'
    where status = 'pending'
      and type = 'bet_won'
      and (metadata->>'market_id')::uuid = p_market_id;

    update public.settlement_payout_holds
    set status = 'cancelled'
    where market_id = p_market_id and status = 'pending';

    update public.markets
    set payout_status = 'voided',
        settlement_override_status = 'voided'
    where id = p_market_id
    returning * into v_market;

    return v_market;
  end if;

  raise exception 'Correction flow not yet implemented';
end;
$$;

-- ============================================================================
-- evaluate_settlement_reopen (hold payouts on challenge)
-- ============================================================================

create or replace function public.evaluate_settlement_reopen(p_market_id uuid)
returns public.settlement_reopen_evaluations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market public.markets;
  v_eligible int;
  v_down int;
  v_up int;
  v_n int;
  v_n_min int;
  v_participation numeric;
  v_p_hat numeric;
  v_threshold numeric := 0.70;
  v_wilson_lower numeric;
  v_z numeric := 1.96;
  v_z2 numeric;
  v_decision text := 'none';
  v_eval public.settlement_reopen_evaluations;
begin
  select * into v_market from public.markets where id = p_market_id;
  if v_market.id is null or v_market.status <> 'resolved' then
    return null;
  end if;

  select count(distinct user_id) into v_eligible
  from public.bets where market_id = p_market_id;

  select
    count(*) filter (where fairness = 'unfair' or score <= 2),
    count(*) filter (where fairness = 'fair' or score >= 4)
  into v_down, v_up
  from public.group_admin_settlement_ratings
  where market_id = p_market_id;

  v_n := coalesce(v_down, 0) + coalesce(v_up, 0);
  v_n_min := greatest(3, ceil(sqrt(greatest(v_eligible, 1)::numeric))::int);
  v_participation := case when v_eligible > 0 then v_n::numeric / v_eligible else 0 end;
  v_p_hat := case when v_n > 0 then v_down::numeric / v_n else 0 end;
  v_threshold := 0.70 - 0.15 * exp(-v_n::numeric / 10);

  if v_n > 0 then
    v_z2 := v_z * v_z;
    v_wilson_lower := (
      v_p_hat + v_z2 / (2 * v_n) -
      v_z * sqrt((v_p_hat * (1 - v_p_hat) + v_z2 / (4 * v_n)) / v_n)
    ) / (1 + v_z2 / v_n);
  else
    v_wilson_lower := 0;
  end if;

  if v_n >= v_n_min and v_participation >= 0.40 and v_wilson_lower > v_threshold then
    v_decision := 'reopen_candidate';
    update public.markets
    set settlement_override_status = 'challenged'
    where id = p_market_id and settlement_override_status = 'none';
  elsif v_n >= v_n_min and v_participation >= 0.40 and v_wilson_lower > v_threshold * 0.85 then
    v_decision := 'review';
  end if;

  if v_decision in ('review', 'reopen_candidate')
    and v_market.payout_status in ('pending_release', 'held')
  then
    perform public.hold_market_payouts(p_market_id);
    update public.markets
    set settlement_override_status = 'challenged'
    where id = p_market_id
      and settlement_override_status in ('none', 'challenged');
  end if;

  insert into public.settlement_reopen_evaluations (
    market_id, n_decisive, p_hat, wilson_lower, threshold_used,
    bayesian_posterior_unfair, collusion_excluded_count, decision
  ) values (
    p_market_id, v_n, v_p_hat, v_wilson_lower, v_threshold,
    0, 0, v_decision
  )
  returning * into v_eval;

  return v_eval;
end;
$$;

-- ============================================================================
-- resolve_market (defer live group payouts)
-- ============================================================================

create or replace function public.resolve_market(
  p_market_id uuid,
  p_winning_option_id uuid,
  p_evidence_url text default null,
  p_evidence_notes text default null
)
returns markets
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_user_id uuid := auth.uid();
    v_market public.markets;
    v_option record;
    v_bet record;
    v_total_pool numeric;
    v_winning_pool numeric;
    v_winning_side text;
    c_vig numeric := 0.0795;
    v_payout_amount numeric := 0;
    v_type text;
    v_defer_live boolean := false;
    v_has_live_winners boolean := false;
    v_releases_at timestamptz;
    v_tx_id uuid;
begin
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;

    select * into v_market from public.markets m where m.id = p_market_id for update;
    if v_market.id is null then
        raise exception 'Market not found';
    end if;

    if v_market.creator_id != v_user_id and not exists (
        select 1 from public.group_members
        where group_id = v_market.group_id
          and user_id = v_user_id
          and role = 'admin'
    ) then
        raise exception 'Only the market creator or group admins can resolve markets';
    end if;

    if v_market.status = 'resolved' then
        raise exception 'Market already resolved';
    end if;

    v_defer_live := v_market.group_id is not null;
    v_releases_at := now() + interval '72 hours';

    insert into public.market_resolution_proofs (
        market_id, resolver_id, winning_option_id, evidence_url, evidence_notes
    ) values (
        p_market_id, v_user_id, p_winning_option_id, p_evidence_url, p_evidence_notes
    );

    select sum(total_pool) into v_total_pool from public.options where market_id = p_market_id;
    if v_total_pool = 0 or v_total_pool is null then
        update public.markets
        set status = 'resolved',
            resolved_at = now(),
            winning_option_id = p_winning_option_id,
            payout_status = 'none'
        where id = p_market_id
        returning * into v_market;
        return v_market;
    end if;

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
            v_loser_pool_after_vig := coalesce(v_loser_pool, 0) * (1 - c_vig);

            for v_bet in
                select b.id, b.user_id, b.amount, b.side, coalesce(b.is_play_mode, false) as is_play_mode
                from public.bets b
                where b.market_id = p_market_id and b.option_id = v_option.id
            loop
                v_payout_amount := 0;
                v_type := 'bet_lost';

                if v_bet.side = v_winning_side and v_winning_pool > 0 then
                    v_payout_amount := v_bet.amount + (v_bet.amount / v_winning_pool) * v_loser_pool_after_vig;
                    v_type := 'bet_won';

                    if v_defer_live and not v_bet.is_play_mode then
                        v_has_live_winners := true;

                        insert into public.transactions (
                          user_id, amount, type, status, is_play_mode, metadata
                        ) values (
                          v_bet.user_id,
                          v_payout_amount,
                          'bet_won',
                          'pending',
                          false,
                          jsonb_build_object(
                            'market_question', v_market.question,
                            'option_label', v_option.label,
                            'bet_id', v_bet.id,
                            'market_id', p_market_id,
                            'wager', v_bet.amount,
                            'side', v_bet.side,
                            'market_type', 'private',
                            'pending_settlement', true,
                            'releases_at', v_releases_at
                          )
                        )
                        returning id into v_tx_id;

                        insert into public.settlement_payout_holds (
                          market_id, bet_id, user_id, amount, releases_at, transaction_id
                        ) values (
                          p_market_id, v_bet.id, v_bet.user_id, v_payout_amount, v_releases_at, v_tx_id
                        );
                    else
                        if v_bet.is_play_mode then
                            update public.wallets
                            set play_balance = play_balance + v_payout_amount,
                                updated_at = now()
                            where user_id = v_bet.user_id;
                        else
                            update public.wallets
                            set balance = balance + v_payout_amount,
                                updated_at = now()
                            where user_id = v_bet.user_id;
                        end if;

                        insert into public.transactions (
                          user_id, amount, type, status, is_play_mode, metadata
                        ) values (
                          v_bet.user_id,
                          v_payout_amount,
                          v_type,
                          'completed',
                          v_bet.is_play_mode,
                          jsonb_build_object(
                            'market_question', v_market.question,
                            'option_label', v_option.label,
                            'bet_id', v_bet.id,
                            'wager', v_bet.amount,
                            'side', v_bet.side,
                            'market_type', 'private'
                          )
                        );
                    end if;
                else
                    insert into public.transactions (
                      user_id, amount, type, status, is_play_mode, metadata
                    ) values (
                      v_bet.user_id,
                      0,
                      v_type,
                      'completed',
                      v_bet.is_play_mode,
                      jsonb_build_object(
                        'market_question', v_market.question,
                        'option_label', v_option.label,
                        'bet_id', v_bet.id,
                        'wager', v_bet.amount,
                        'side', v_bet.side,
                        'market_type', 'private'
                      )
                    );
                end if;
            end loop;
        end;
    end loop;

    update public.markets
    set status = 'resolved',
        resolved_at = now(),
        winning_option_id = p_winning_option_id,
        payout_release_at = case when v_has_live_winners then v_releases_at else null end,
        payout_status = case
          when v_has_live_winners then 'pending_release'
          else 'released'
        end
    where id = p_market_id
    returning * into v_market;

    return v_market;
end;
$function$;

-- ============================================================================
-- Cron: release due payouts every 30 minutes
-- ============================================================================

create or replace function public.invoke_settlement_payout_release_cron()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.release_due_settlement_payouts();
end;
$$;

revoke all on function public.invoke_settlement_payout_release_cron() from public;
grant execute on function public.invoke_settlement_payout_release_cron() to postgres;

do $$
declare
  v_jobid bigint;
begin
  for v_jobid in
    select jobid from cron.job where jobname = 'release-due-settlement-payouts'
  loop
    perform cron.unschedule(v_jobid);
  end loop;
exception
  when undefined_table then null;
  when undefined_object then null;
end;
$$;

-- Use tagged dollar-quotes so the cron command body can keep $$ without
-- terminating this DO block early (42P13 sibling: nested $$ is a syntax error).
do $schedule_settlement_payout_cron$
begin
  perform cron.schedule(
    'release-due-settlement-payouts',
    '*/30 * * * *',
    $$ select public.invoke_settlement_payout_release_cron(); $$
  );
exception
  when undefined_table then
    raise notice 'pg_cron not available; schedule release-due-settlement-payouts manually';
  when undefined_object then
    raise notice 'pg_cron not available; schedule release-due-settlement-payouts manually';
end;
$schedule_settlement_payout_cron$;

grant execute on function public.release_market_payouts(uuid, boolean) to authenticated;
grant execute on function public.release_due_settlement_payouts() to authenticated;
grant execute on function public.hold_market_payouts(uuid) to authenticated;
grant execute on function public.get_pending_settlement_payouts() to authenticated;
grant execute on function public.platform_review_settlement(uuid, text) to authenticated;

commit;
