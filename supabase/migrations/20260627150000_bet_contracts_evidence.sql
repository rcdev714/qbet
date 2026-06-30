begin;

-- ============================================================================
-- Phase 4: Bet contract evidence snapshots (wallet-tied wager agreements)
-- ============================================================================

create table if not exists public.bet_contracts (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null unique references public.bets(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id),
  user_id uuid not null references public.users(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  contract_number text not null unique,
  jurisdiction text not null default 'US',
  placed_snapshot jsonb not null,
  resolved_snapshot jsonb,
  placed_email_sent_at timestamptz,
  resolved_email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_bet_contracts_user_id
  on public.bet_contracts(user_id, created_at desc);

create index if not exists idx_bet_contracts_market_id
  on public.bet_contracts(market_id);

alter table public.bet_contracts enable row level security;

drop policy if exists "Users can view own bet contracts" on public.bet_contracts;
create policy "Users can view own bet contracts"
  on public.bet_contracts
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.build_bet_contract_number(p_bet_id uuid, p_placed_at timestamptz)
returns text
language sql
stable
as $$
  select 'QBET-' || to_char(p_placed_at at time zone 'utc', 'YYYYMMDD') || '-' || upper(substr(replace(p_bet_id::text, '-', ''), 1, 8));
$$;

create or replace function public.create_bet_contract_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market public.markets;
  v_wallet public.wallets;
  v_user public.users;
  v_option public.options;
  v_group public.groups;
  v_jurisdiction text;
  v_members jsonb;
  v_policies jsonb;
  v_contract_number text;
begin
  if new.is_play_mode is true then
    return new;
  end if;

  select * into v_market from public.markets where id = new.market_id;
  if v_market.id is null or v_market.is_public is true or v_market.group_id is null then
    return new;
  end if;

  select * into v_wallet from public.wallets where user_id = new.user_id;
  if v_wallet.id is null then
    return new;
  end if;

  select * into v_user from public.users where id = new.user_id;
  select * into v_option from public.options where id = new.option_id;
  select * into v_group from public.groups where id = v_market.group_id;

  v_jurisdiction := public.get_user_compliance_jurisdiction(new.user_id);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'userId', gm.user_id,
      'username', coalesce(u.username, split_part(u.email, '@', 1)),
      'role', gm.role
    )
    order by gm.joined_at
  ), '[]'::jsonb)
  into v_members
  from public.group_members gm
  join public.users u on u.id = gm.user_id
  where gm.group_id = v_market.group_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'kind', pv.kind,
      'version', pv.version,
      'title', pv.title,
      'url', pv.url,
      'contentHash', pv.content_hash,
      'acceptedAt', upa.accepted_at,
      'locale', pv.locale
    )
    order by pv.kind
  ), '[]'::jsonb)
  into v_policies
  from public.user_policy_acceptances upa
  join public.policy_versions pv on pv.id = upa.policy_version_id
  where upa.user_id = new.user_id
    and pv.jurisdiction = v_jurisdiction
    and pv.locale = public.get_user_policy_locale(new.user_id);

  v_contract_number := public.build_bet_contract_number(new.id, coalesce(new.placed_at, now()));

  insert into public.bet_contracts (
    bet_id,
    wallet_id,
    user_id,
    market_id,
    group_id,
    contract_number,
    jurisdiction,
    placed_snapshot
  )
  values (
    new.id,
    v_wallet.id,
    new.user_id,
    new.market_id,
    v_market.group_id,
    v_contract_number,
    v_jurisdiction,
    jsonb_build_object(
      'version', '1',
      'contractNumber', v_contract_number,
      'issuedAt', new.placed_at,
      'bettor', jsonb_build_object(
        'userId', new.user_id,
        'username', coalesce(v_user.username, split_part(v_user.email, '@', 1)),
        'email', v_user.email
      ),
      'wallet', jsonb_build_object(
        'walletId', v_wallet.id,
        'currency', coalesce(v_wallet.currency, 'USD'),
        'country', v_wallet.country,
        'debitAmount', new.amount
      ),
      'position', jsonb_build_object(
        'betId', new.id,
        'optionId', new.option_id,
        'optionLabel', coalesce(v_option.label, 'Unknown'),
        'side', new.side,
        'amount', new.amount,
        'placedAt', new.placed_at
      ),
      'market', jsonb_build_object(
        'marketId', v_market.id,
        'question', v_market.question,
        'closesAt', v_market.closes_at,
        'creatorUsername', (
          select coalesce(u2.username, split_part(u2.email, '@', 1))
          from public.users u2
          where u2.id = v_market.creator_id
        ),
        'status', v_market.status
      ),
      'group', jsonb_build_object(
        'groupId', v_group.id,
        'name', v_group.name,
        'adminUsername', (
          select coalesce(u3.username, split_part(u3.email, '@', 1))
          from public.users u3
          where u3.id = v_group.admin_id
        ),
        'memberCount', jsonb_array_length(v_members),
        'members', v_members
      ),
      'legal', jsonb_build_object(
        'jurisdiction', v_jurisdiction,
        'acceptedPolicies', v_policies,
        'policyRoutes', jsonb_build_array('/terms', '/privacy', '/risk', '/market-rules', '/aml-kyc', '/prohibited-markets'),
        'disclaimers', jsonb_build_array(
          'Parimutuel wager: stake debited from your wallet and pooled with other participants.',
          'Anymarkt is a platform facilitator, not a counterparty to individual wagers.',
          'Live wallet participation involves real-fund loss risk.',
          'Markets must resolve using published objective criteria.'
        )
      )
    )
  )
  on conflict (bet_id) do nothing;

  return new;
end;
$$;

drop trigger if exists tr_create_bet_contract_on_insert on public.bets;
create trigger tr_create_bet_contract_on_insert
  after insert on public.bets
  for each row
  execute function public.create_bet_contract_on_insert();

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
  if new.status <> 'resolved' or coalesce(old.status, '') = 'resolved' then
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

drop trigger if exists tr_update_bet_contracts_on_resolution on public.markets;
create trigger tr_update_bet_contracts_on_resolution
  after update on public.markets
  for each row
  execute function public.update_bet_contracts_on_resolution();

create or replace function public.mark_bet_contract_email_sent(
  p_contract_id uuid,
  p_event_type text
)
returns public.bet_contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract public.bet_contracts;
begin
  if p_event_type = 'placed' then
    update public.bet_contracts
    set placed_email_sent_at = now()
    where id = p_contract_id
    returning * into v_contract;
  elsif p_event_type = 'resolved' then
    update public.bet_contracts
    set resolved_email_sent_at = now()
    where id = p_contract_id
    returning * into v_contract;
  else
    raise exception 'Invalid event type: %', p_event_type;
  end if;

  return v_contract;
end;
$$;

create or replace function public.get_bet_contract_by_bet_id(p_bet_id uuid)
returns public.bet_contracts
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_contract public.bet_contracts;
begin
  select * into v_contract
  from public.bet_contracts bc
  where bc.bet_id = p_bet_id
    and bc.user_id = auth.uid();

  return v_contract;
end;
$$;

create or replace view public.bet_contract_evidence_export
with (security_invoker = true)
as
select
  bc.id as contract_id,
  bc.contract_number,
  bc.bet_id,
  bc.wallet_id,
  bc.user_id,
  bc.market_id,
  bc.group_id,
  bc.jurisdiction,
  bc.placed_snapshot,
  bc.resolved_snapshot,
  bc.placed_email_sent_at,
  bc.resolved_email_sent_at,
  bc.created_at,
  bc.resolved_at,
  u.email as bettor_email,
  u.username as bettor_username
from public.bet_contracts bc
join public.users u on u.id = bc.user_id;

revoke all on function public.mark_bet_contract_email_sent(uuid, text) from public, anon, authenticated;
grant execute on function public.mark_bet_contract_email_sent(uuid, text) to service_role;

grant execute on function public.get_bet_contract_by_bet_id(uuid) to authenticated, service_role;

commit;
