-- Fix enum cast error when resetting markets: coalesce(old.status, '') compared to ''.
create or replace function public.update_bet_contracts_on_resolution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract record;
  v_won boolean;
  v_payout numeric := 0;
  v_winning_label text;
begin
  if new.status is distinct from 'resolved'::public.market_status
      or old.status = 'resolved'::public.market_status then
    return new;
  end if;

  select label into v_winning_label
  from public.options
  where id = new.winning_option_id;

  for v_contract in
    select bc.id, bc.bet_id, b.user_id, b.option_id, b.side, b.amount, b.is_play_mode
    from public.bet_contracts bc
    join public.bets b on b.id = bc.bet_id
    where bc.market_id = new.id
      and bc.resolved_snapshot is null
  loop
    v_won := (v_contract.option_id = new.winning_option_id and v_contract.side = 'yes')
          or (v_contract.option_id <> new.winning_option_id and v_contract.side = 'no');

    select coalesce(t.amount, 0)
    into v_payout
    from public.transactions t
    where t.user_id = v_contract.user_id
      and t.reference_id = v_contract.bet_id::text
      and t.type = 'bet_won'
      and t.status = 'completed'
    order by t.created_at desc
    limit 1;

    update public.bet_contracts
    set resolved_snapshot = jsonb_build_object(
          'resolvedAt', new.resolved_at,
          'winningOptionLabel', v_winning_label,
          'outcome', case when v_won then 'won' else 'lost' end,
          'payoutAmount', v_payout,
          'vigRate', 0.0795
        ),
        resolved_at = coalesce(new.resolved_at, now())
    where id = v_contract.id;
  end loop;

  return new;
end;
$$;
