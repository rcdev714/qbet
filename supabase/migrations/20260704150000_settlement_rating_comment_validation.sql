-- Require written explanation for negative settlement ratings (asymmetric friction).

begin;

create or replace function public.submit_admin_settlement_rating(
  p_market_id uuid,
  p_score smallint,
  p_fairness text,
  p_comment text default null
)
returns public.group_admin_settlement_ratings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_market public.markets;
  v_admin_id uuid;
  v_rating public.group_admin_settlement_ratings;
  v_comment text := nullif(trim(p_comment), '');
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_fairness = 'unclear' or p_score = 3 then
    raise exception 'Neutral ratings are not accepted';
  end if;

  if p_fairness = 'unfair' or p_score <= 2 then
    if v_comment is null or length(v_comment) < 20 then
      raise exception 'Concern ratings require a comment of at least 20 characters';
    end if;
  end if;

  select * into v_market from public.markets where id = p_market_id;
  if v_market.id is null or v_market.status <> 'resolved' then
    raise exception 'Market must be resolved to rate';
  end if;
  if v_market.group_id is null then
    raise exception 'Not a group market';
  end if;

  if not exists (
    select 1 from public.bets b
    where b.market_id = p_market_id and b.user_id = v_user_id
  ) then
    raise exception 'Only bettors may rate settlements';
  end if;

  select g.admin_id into v_admin_id from public.groups g where g.id = v_market.group_id;

  insert into public.group_admin_settlement_ratings (
    market_id, group_id, admin_id, rater_id, score, fairness, comment
  ) values (
    p_market_id, v_market.group_id, v_admin_id, v_user_id, p_score, p_fairness, v_comment
  )
  on conflict (market_id, rater_id) do update
    set score = excluded.score,
        fairness = excluded.fairness,
        comment = excluded.comment
  returning * into v_rating;

  perform public.evaluate_settlement_reopen(p_market_id);

  return v_rating;
end;
$$;

commit;
