-- Reset betting / wallet / ledger activity on production.
-- Preserves: auth.users, public.users, groups, markets (reopened), policies, beta access.
-- Run: npx supabase db query --linked --file scripts/reset-prod-financial-data.sql

begin;

delete from public.accounting_ledger_entries;
delete from public.crypto_transactions;
delete from public.crypto_payments;
delete from public.bet_contracts;
delete from public.bets;
delete from public.transactions;
delete from public.market_resolution_proofs;
delete from public.disputes;

update public.options
set yes_pool = 0,
    no_pool = 0,
    total_pool = 0;

update public.markets
set status = 'open',
    winning_option_id = null,
    resolved_at = null
where status = 'resolved';

update public.wallets
set balance = 0,
    play_balance = 1000,
    updated_at = now();

commit;
