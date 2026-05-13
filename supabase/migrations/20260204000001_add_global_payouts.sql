-- Add global_recipient_id column for Stripe Global Payouts v2 API
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS global_recipient_id text;

-- Add payout_method_id column for storing the user's payout method
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS payout_method_id text;

-- Comment explaining the new columns
COMMENT ON COLUMN wallets.global_recipient_id IS 'Stripe Global Payouts v2 recipient account ID';
COMMENT ON COLUMN wallets.payout_method_id IS 'Stripe payout method ID for withdrawals (bank account, etc)';
