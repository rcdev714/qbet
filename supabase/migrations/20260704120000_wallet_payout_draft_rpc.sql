-- Allow users to save non-sensitive payout draft fields on their wallet
create or replace function public.save_wallet_payout_draft(p_draft jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_allowed_keys text[] := array[
    'bank_code', 'bank_name', 'swift', 'city', 'province',
    'first_name', 'last_name', 'address_line1', 'postal_code', 'updated_at'
  ];
  v_key text;
  v_sanitized jsonb := '{}'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_draft is null or jsonb_typeof(p_draft) <> 'object' then
    raise exception 'Invalid draft payload' using errcode = '22023';
  end if;

  for v_key in select unnest(v_allowed_keys)
  loop
    if p_draft ? v_key then
      v_sanitized := v_sanitized || jsonb_build_object(v_key, p_draft -> v_key);
    end if;
  end loop;

  v_sanitized := v_sanitized || jsonb_build_object(
    'updated_at', coalesce(p_draft ->> 'updated_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
  );

  update public.wallets
  set bank_details = coalesce(bank_details, '{}'::jsonb) || v_sanitized
  where user_id = v_user_id;

  if not found then
    raise exception 'Wallet not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.save_wallet_payout_draft(jsonb) from public, anon;
grant execute on function public.save_wallet_payout_draft(jsonb) to authenticated, service_role;
