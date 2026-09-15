-- Store non-sensitive payout profile draft on the wallet (bank name, SWIFT, address fields).
-- Sensitive values (full account number, cédula) must never be persisted here.
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS bank_details jsonb;

COMMENT ON COLUMN public.wallets.bank_details IS
  'Non-sensitive payout profile draft: bank_name, swift, city, province, first_name, last_name, etc.';
