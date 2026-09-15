begin;

select plan(5);

select has_function(
  'public',
  'save_wallet_payout_draft',
  array['jsonb'],
  'save_wallet_payout_draft(jsonb) exists'
);

select has_column(
  'public',
  'wallets',
  'bank_details',
  'wallets.bank_details column exists'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.save_wallet_payout_draft(jsonb)',
    'EXECUTE'
  ),
  true,
  'authenticated can execute save_wallet_payout_draft'
);

select isnt(
  has_function_privilege(
    'anon',
    'public.save_wallet_payout_draft(jsonb)',
    'EXECUTE'
  ),
  true,
  'anon cannot execute save_wallet_payout_draft'
);

select isnt(
  has_function_privilege(
    'public',
    'public.save_wallet_payout_draft(jsonb)',
    'EXECUTE'
  ),
  true,
  'public role cannot execute save_wallet_payout_draft'
);

select * from finish();

rollback;
