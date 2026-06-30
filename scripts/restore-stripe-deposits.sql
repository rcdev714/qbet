-- Restore wallet credits from verified live Stripe wallet_topup payments.
-- Idempotent: apply_wallet_topup uses reference_id (payment_intent id) for dedup.
-- Source: Anymarkt live Stripe account reconciled 2026-06-23.

begin;

-- juan.salgador@uisek.edu.ec ($2 + $2 + $3.33 = $7.33)
select public.apply_wallet_topup(
  '16a381b4-baad-442a-b163-1135e986abb7'::uuid,
  2.00,
  'pi_3SworvRdKjhyWYl40CAz22tn',
  'restore-after-reset-pi_3SworvRdKjhyWYl40CAz22tn',
  '{"source":"stripe_reconcile","checkout":false}'::jsonb
);

select public.apply_wallet_topup(
  '16a381b4-baad-442a-b163-1135e986abb7'::uuid,
  2.00,
  'pi_3SwwTlRdKjhyWYl40MAI1Z0K',
  'restore-after-reset-pi_3SwwTlRdKjhyWYl40MAI1Z0K',
  '{"source":"stripe_reconcile","checkout":false}'::jsonb
);

select public.apply_wallet_topup(
  '16a381b4-baad-442a-b163-1135e986abb7'::uuid,
  3.33,
  'pi_3Sz3wmRdKjhyWYl41UkL1e0k',
  'restore-after-reset-pi_3Sz3wmRdKjhyWYl41UkL1e0k',
  '{"source":"stripe_reconcile","checkout":true}'::jsonb
);

-- dmazuera5@gmail.com ($10.00)
select public.apply_wallet_topup(
  '553d2050-b9cb-451e-8e21-ce34453db5de'::uuid,
  10.00,
  'pi_3T1hyARdKjhyWYl40nYKV2tX',
  'restore-after-reset-pi_3T1hyARdKjhyWYl40nYKV2tX',
  '{"source":"stripe_reconcile","checkout":true}'::jsonb
);

commit;
