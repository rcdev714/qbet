begin;

select plan(8);

select policy_is(
  'public',
  'bets',
  'bets_insert_none',
  'authenticated',
  'insert',
  'direct bet insert denied for authenticated'
);

select policy_is(
  'public',
  'options',
  'options_insert_none',
  'authenticated',
  'insert',
  'direct option insert denied for authenticated'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'add_funds'
  ),
  'add_funds function removed'
);

select isnt(
  has_function_privilege(
    'authenticated',
    'public.record_compliance_event(uuid,text,text,text,text,jsonb,text,text,uuid,uuid)',
    'EXECUTE'
  ),
  true,
  'authenticated cannot execute record_compliance_event'
);

select isnt(
  has_function_privilege(
    'anon',
    'public.get_beta_access_request_by_email(text)',
    'EXECUTE'
  ),
  true,
  'anon cannot execute get_beta_access_request_by_email'
);

select has_function(
  'public',
  'lookup_wallet_recipient',
  array['text'],
  'wallet recipient lookup exists'
);

select has_policy(
  'public',
  'wallets',
  'wallets_insert_zero_balance',
  'wallet insert policy requires zero balance'
);

select has_function(
  'public',
  'place_bet',
  array['uuid', 'uuid', 'numeric', 'text', 'boolean'],
  'place_bet RPC remains available'
);

select * from finish();

rollback;
