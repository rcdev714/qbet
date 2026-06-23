-- Use bet placed_at for deterministic contract numbers (not now()).
create or replace function public.build_bet_contract_number(p_bet_id uuid, p_placed_at timestamptz)
returns text
language sql
stable
as $$
  select 'QBET-' || to_char(p_placed_at at time zone 'utc', 'YYYYMMDD') || '-' || upper(substr(replace(p_bet_id::text, '-', ''), 1, 8));
$$;
