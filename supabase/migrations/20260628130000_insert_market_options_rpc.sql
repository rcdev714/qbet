begin;

-- Options inserts were locked down in security_boundary_hardening; route market
-- creation flows through a guarded RPC instead of direct client writes.

create or replace function public.insert_market_options(
  p_market_id uuid,
  p_labels text[]
)
returns setof public.options
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_market public.markets;
  v_label text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_market
  from public.markets
  where id = p_market_id;

  if v_market.id is null then
    raise exception 'Market not found' using errcode = 'P0002';
  end if;

  if v_market.creator_id <> v_user_id then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if v_market.group_id is not null
      and public.is_group_member(v_market.group_id, v_user_id) is not true then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if v_market.group_id is null and coalesce(v_market.is_public, false) is true then
    if public.is_app_admin(v_user_id) is not true then
      raise exception 'Forbidden' using errcode = '42501';
    end if;
  end if;

  if p_labels is null
      or array_length(p_labels, 1) is null
      or array_length(p_labels, 1) < 2 then
    raise exception 'At least two options required' using errcode = '22023';
  end if;

  foreach v_label in array p_labels loop
    if btrim(coalesce(v_label, '')) = '' then
      raise exception 'Option labels cannot be empty' using errcode = '22023';
    end if;
  end loop;

  if exists (select 1 from public.options o where o.market_id = p_market_id) then
    raise exception 'Options already exist for this market' using errcode = '23505';
  end if;

  perform public.assert_compliance_gate(v_user_id, 'create_market', p_market_id);

  return query
  insert into public.options (market_id, label, total_pool)
  select p_market_id, btrim(lbl), 0
  from unnest(p_labels) as lbl
  returning *;
end;
$$;

revoke all on function public.insert_market_options(uuid, text[]) from public, anon;
grant execute on function public.insert_market_options(uuid, text[]) to authenticated, service_role;

commit;
