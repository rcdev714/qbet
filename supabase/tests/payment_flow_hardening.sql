begin;

select plan(9);

select has_table(
  'public',
  'stripe_charge_refunds',
  'tracks cumulative charge.refunded totals for delta refunds'
);

select has_function(
  'public',
  'apply_wallet_topup',
  array['uuid', 'numeric', 'text', 'text', 'jsonb'],
  'top-up RPC exists'
);

select has_function(
  'public',
  'apply_wallet_refund',
  array['uuid', 'numeric', 'text', 'text', 'jsonb'],
  'refund RPC exists'
);

select has_function(
  'public',
  'reserve_wallet_withdrawal',
  array['uuid', 'numeric', 'text', 'jsonb'],
  'withdrawal reservation RPC exists'
);

select isnt(
  has_function_privilege(
    'authenticated',
    'public.apply_wallet_topup(uuid,numeric,text,text,jsonb)',
    'EXECUTE'
  ),
  true,
  'authenticated cannot execute apply_wallet_topup'
);

select isnt(
  has_function_privilege(
    'authenticated',
    'public.apply_wallet_refund(uuid,numeric,text,text,jsonb)',
    'EXECUTE'
  ),
  true,
  'authenticated cannot execute apply_wallet_refund'
);

select isnt(
  has_function_privilege(
    'authenticated',
    'public.reserve_wallet_withdrawal(uuid,numeric,text,jsonb)',
    'EXECUTE'
  ),
  true,
  'authenticated cannot execute reserve_wallet_withdrawal'
);

select throws_ok(
  $$ select internal_payments.apply_wallet_topup(gen_random_uuid(), 0, 'pi_test', 'evt_test', '{}'::jsonb) $$,
  'P0001',
  'Top-up amount must be positive',
  'top-up rejects non-positive amounts'
);

select throws_ok(
  $$ select internal_payments.apply_wallet_refund(gen_random_uuid(), 0, 're_test', 'evt_refund_test', '{}'::jsonb) $$,
  'P0001',
  'Refund amount must be positive',
  'refund rejects non-positive amounts'
);

select * from finish();

rollback;
