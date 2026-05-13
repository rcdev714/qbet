-- Phase 2 engine invariants:
-- 1. Ensure bets and winning options always belong to the target market
-- 2. Restore transaction reference IDs for bet lifecycle records
-- 3. Make market resolution idempotent enough to avoid duplicate payouts on retries

begin;

-- ============================================================================
-- Cross-table invariants
-- ============================================================================

create unique index if not exists idx_options_id_market_id
  on public.options (id, market_id);

alter table public.bets
  drop constraint if exists bets_option_id_fkey;

alter table public.bets
  drop constraint if exists bets_option_matches_market_fkey;

alter table public.bets
  add constraint bets_option_matches_market_fkey
  foreign key (option_id, market_id)
  references public.options (id, market_id)
  on delete cascade;

alter table public.markets
  drop constraint if exists options_market_id_fkey;

alter table public.markets
  drop constraint if exists markets_winning_option_id_fkey;

alter table public.markets
  drop constraint if exists markets_winning_option_matches_market_fkey;

alter table public.markets
  add constraint markets_winning_option_matches_market_fkey
  foreign key (winning_option_id, id)
  references public.options (id, market_id);

-- ============================================================================
-- place_bet: fail early when option and market do not match, and restore the
-- transaction reference_id used by downstream settlement bookkeeping.
-- ============================================================================

create or replace function public.place_bet(
  p_market_id uuid,
  p_option_id uuid,
  p_amount numeric,
  p_side text default 'yes',
  p_is_play_mode boolean default false
)
returns public.bets
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_market public.markets;
  v_wallet public.wallets;
  v_bet public.bets;
  v_option_label text;
  v_side text := lower(coalesce(p_side, 'yes'));
  v_current_balance numeric;
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

  select * into v_market
  from public.markets m
  where m.id = p_market_id;

  if v_market.id is null then
    raise exception 'Market not found';
  end if;

  if v_market.status <> 'open' then
    raise exception 'Market is not open';
  end if;

  if v_market.closes_at is not null and now() >= v_market.closes_at then
    raise exception 'Market is closed';
  end if;

  if v_market.is_public is not true then
    if not public.is_group_member(v_market.group_id, v_user_id) then
      raise exception 'Not a member of this group';
    end if;
  end if;

  select * into v_wallet
  from public.wallets w
  where w.user_id = v_user_id
  for update;

  if v_wallet.id is null then
    raise exception 'Wallet not found';
  end if;

  if p_is_play_mode then
    v_current_balance := v_wallet.play_balance;
  else
    v_current_balance := v_wallet.balance;
  end if;

  if v_current_balance < p_amount then
    raise exception 'Insufficient balance';
  end if;

  select label into v_option_label
  from public.options
  where id = p_option_id
    and market_id = p_market_id;

  if v_option_label is null then
    raise exception 'Option does not belong to market';
  end if;

  if p_is_play_mode then
    update public.wallets
    set play_balance = play_balance - p_amount
    where user_id = v_user_id;
  else
    update public.wallets
    set balance = balance - p_amount
    where user_id = v_user_id;
  end if;

  insert into public.bets(user_id, market_id, option_id, amount, side, is_play_mode)
  values (v_user_id, p_market_id, p_option_id, p_amount, v_side, p_is_play_mode)
  returning * into v_bet;

  insert into public.transactions (
    user_id,
    amount,
    type,
    status,
    reference_id,
    is_play_mode,
    metadata
  )
  values (
    v_user_id,
    -p_amount,
    'bet_placed',
    'completed',
    v_bet.id::text,
    p_is_play_mode,
    jsonb_build_object(
      'market_question', v_market.question,
      'option_label', v_option_label,
      'bet_id', v_bet.id,
      'market_id', p_market_id,
      'side', v_side,
      'is_play_mode', p_is_play_mode
    )
  )
  on conflict (reference_id, type) where reference_id is not null do nothing;

  return v_bet;
end;
$function$;

-- ============================================================================
-- resolve_public_market: enforce winning option consistency, upsert proof, and
-- prevent duplicate wallet credits on retries.
-- ============================================================================

create or replace function public.resolve_public_market(
    p_market_id uuid,
    p_winning_option_id uuid,
    p_evidence_url text default null,
    p_evidence_notes text default null
)
returns public.markets
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
    v_user_id uuid := auth.uid();
    v_is_admin boolean;
    v_market public.markets;
    v_option record;
    v_bet record;
    v_total_pool numeric;
    v_winning_pool numeric;
    v_winning_side text;
    v_payout_amount numeric;
    v_type text;
    c_vig numeric := 0.0795;
begin
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;

    select is_admin into v_is_admin from public.users where id = v_user_id;
    if v_is_admin is not true then
        raise exception 'Only app admins can resolve public markets';
    end if;

    select * into v_market
    from public.markets m
    where m.id = p_market_id
    for update;

    if v_market.id is null then
        raise exception 'Market not found';
    end if;

    if v_market.is_public is not true then
        raise exception 'This function only resolves public markets. Use resolve_market for group markets.';
    end if;

    if v_market.status = 'resolved' then
        raise exception 'Market already resolved';
    end if;

    if not exists (
        select 1
        from public.options
        where id = p_winning_option_id
          and market_id = p_market_id
    ) then
        raise exception 'Winning option does not belong to market';
    end if;

    insert into public.market_resolution_proofs (
        market_id,
        resolver_id,
        winning_option_id,
        evidence_url,
        evidence_notes
    ) values (
        p_market_id,
        v_user_id,
        p_winning_option_id,
        p_evidence_url,
        p_evidence_notes
    )
    on conflict (market_id) do update
      set resolver_id = excluded.resolver_id,
          winning_option_id = excluded.winning_option_id,
          evidence_url = excluded.evidence_url,
          evidence_notes = excluded.evidence_notes,
          resolved_at = now();

    select sum(total_pool) into v_total_pool
    from public.options
    where market_id = p_market_id;

    if v_total_pool = 0 or v_total_pool is null then
        update public.markets
        set status = 'resolved',
            resolved_at = now(),
            winning_option_id = p_winning_option_id
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
            v_tx_inserted boolean;
        begin
            v_winning_side := case when v_option.id = p_winning_option_id then 'yes' else 'no' end;
            v_winning_pool := case when v_winning_side = 'yes' then v_option.yes_pool else v_option.no_pool end;
            v_loser_pool := case when v_winning_side = 'yes' then v_option.no_pool else v_option.yes_pool end;
            v_loser_pool_after_vig := coalesce(v_loser_pool, 0) * (1 - c_vig);

            for v_bet in
                select b.id, b.user_id, b.amount, b.side, coalesce(b.is_play_mode, false) as is_play_mode
                from public.bets b
                where b.market_id = p_market_id
                  and b.option_id = v_option.id
            loop
                v_payout_amount := 0;
                v_type := 'bet_lost';

                if v_bet.side = v_winning_side and v_winning_pool > 0 then
                    v_payout_amount := v_bet.amount + (v_bet.amount / v_winning_pool) * v_loser_pool_after_vig;
                    v_type := 'bet_won';
                end if;

                with inserted_tx as (
                    insert into public.transactions (
                        user_id,
                        amount,
                        type,
                        status,
                        reference_id,
                        is_play_mode,
                        metadata
                    )
                    values (
                        v_bet.user_id,
                        v_payout_amount,
                        v_type,
                        'completed',
                        v_bet.id::text,
                        v_bet.is_play_mode,
                        jsonb_build_object(
                            'market_question', v_market.question,
                            'option_label', v_option.label,
                            'bet_id', v_bet.id,
                            'wager', v_bet.amount,
                            'side', v_bet.side,
                            'market_type', 'public',
                            'is_play_mode', v_bet.is_play_mode
                        )
                    )
                    on conflict (reference_id, type) where reference_id is not null do nothing
                    returning 1
                )
                select exists(select 1 from inserted_tx) into v_tx_inserted;

                if v_tx_inserted and v_type = 'bet_won' then
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
                end if;
            end loop;
        end;
    end loop;

    update public.markets
    set status = 'resolved',
        resolved_at = now(),
        winning_option_id = p_winning_option_id
    where id = p_market_id
    returning * into v_market;

    return v_market;
end;
$function$;

-- ============================================================================
-- resolve_market: same invariants and idempotent payout behavior for group
-- markets.
-- ============================================================================

create or replace function public.resolve_market(
    p_market_id uuid,
    p_winning_option_id uuid,
    p_evidence_url text default null,
    p_evidence_notes text default null
)
returns public.markets
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
    v_user_id uuid := auth.uid();
    v_market public.markets;
    v_option record;
    v_bet record;
    v_total_pool numeric;
    v_winning_pool numeric;
    v_winning_side text;
    v_payout_amount numeric;
    v_type text;
    c_vig numeric := 0.0795;
begin
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;

    select * into v_market
    from public.markets m
    where m.id = p_market_id
    for update;

    if v_market.id is null then
        raise exception 'Market not found';
    end if;

    if not exists (
        select 1
        from public.group_members
        where group_id = v_market.group_id
          and user_id = v_user_id
          and role = 'admin'
    ) then
        raise exception 'Only group admins can resolve markets';
    end if;

    if v_market.status = 'resolved' then
        raise exception 'Market already resolved';
    end if;

    if not exists (
        select 1
        from public.options
        where id = p_winning_option_id
          and market_id = p_market_id
    ) then
        raise exception 'Winning option does not belong to market';
    end if;

    insert into public.market_resolution_proofs (
        market_id,
        resolver_id,
        winning_option_id,
        evidence_url,
        evidence_notes
    ) values (
        p_market_id,
        v_user_id,
        p_winning_option_id,
        p_evidence_url,
        p_evidence_notes
    )
    on conflict (market_id) do update
      set resolver_id = excluded.resolver_id,
          winning_option_id = excluded.winning_option_id,
          evidence_url = excluded.evidence_url,
          evidence_notes = excluded.evidence_notes,
          resolved_at = now();

    select sum(total_pool) into v_total_pool
    from public.options
    where market_id = p_market_id;

    if v_total_pool = 0 or v_total_pool is null then
        update public.markets
        set status = 'resolved',
            resolved_at = now(),
            winning_option_id = p_winning_option_id
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
            v_tx_inserted boolean;
        begin
            v_winning_side := case when v_option.id = p_winning_option_id then 'yes' else 'no' end;
            v_winning_pool := case when v_winning_side = 'yes' then v_option.yes_pool else v_option.no_pool end;
            v_loser_pool := case when v_winning_side = 'yes' then v_option.no_pool else v_option.yes_pool end;
            v_loser_pool_after_vig := coalesce(v_loser_pool, 0) * (1 - c_vig);

            for v_bet in
                select b.id, b.user_id, b.amount, b.side, coalesce(b.is_play_mode, false) as is_play_mode
                from public.bets b
                where b.market_id = p_market_id
                  and b.option_id = v_option.id
            loop
                v_payout_amount := 0;
                v_type := 'bet_lost';

                if v_bet.side = v_winning_side and v_winning_pool > 0 then
                    v_payout_amount := v_bet.amount + (v_bet.amount / v_winning_pool) * v_loser_pool_after_vig;
                    v_type := 'bet_won';
                end if;

                with inserted_tx as (
                    insert into public.transactions (
                        user_id,
                        amount,
                        type,
                        status,
                        reference_id,
                        is_play_mode,
                        metadata
                    )
                    values (
                        v_bet.user_id,
                        v_payout_amount,
                        v_type,
                        'completed',
                        v_bet.id::text,
                        v_bet.is_play_mode,
                        jsonb_build_object(
                            'market_question', v_market.question,
                            'option_label', v_option.label,
                            'bet_id', v_bet.id,
                            'wager', v_bet.amount,
                            'side', v_bet.side,
                            'market_type', 'private',
                            'is_play_mode', v_bet.is_play_mode
                        )
                    )
                    on conflict (reference_id, type) where reference_id is not null do nothing
                    returning 1
                )
                select exists(select 1 from inserted_tx) into v_tx_inserted;

                if v_tx_inserted and v_type = 'bet_won' then
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
                end if;
            end loop;
        end;
    end loop;

    update public.markets
    set status = 'resolved',
        resolved_at = now(),
        winning_option_id = p_winning_option_id
    where id = p_market_id
    returning * into v_market;

    return v_market;
end;
$function$;

commit;
