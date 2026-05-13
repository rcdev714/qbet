-- Reconcile wallet balance from Stripe-verified DEPOSITS only
-- This fixes balances that were inflated during testing with fake money
-- We ignore withdrawals because those were made using fake money and 
-- the funds never actually left Stripe

-- Create reconciliation function (deposits only version)
CREATE OR REPLACE FUNCTION public.reconcile_wallet_from_stripe_deposits(p_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calculated_balance numeric;
  v_old_balance numeric;
BEGIN
  -- Get current balance for logging
  SELECT balance INTO v_old_balance
  FROM public.wallets
  WHERE user_id = p_user_id;

  -- Calculate balance from ONLY verified Stripe deposits
  -- Ignore withdrawals because they were made with fake money
  SELECT COALESCE(SUM(amount), 0) INTO v_calculated_balance
  FROM public.transactions
  WHERE user_id = p_user_id
    AND type = 'deposit' 
    AND status = 'completed'
    AND metadata ? 'stripe_payment_intent_id'
    AND (is_play_mode IS NULL OR is_play_mode = false);
  
  -- Update wallet with calculated balance (minimum 0)
  UPDATE public.wallets
  SET balance = GREATEST(v_calculated_balance, 0),
      -- Reset withdrawal tracking since those were fake
      total_withdrawn = 0,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- Log the reconciliation
  RAISE NOTICE 'Reconciled wallet for user %: % -> %', 
    p_user_id, v_old_balance, v_calculated_balance;
  
  RETURN v_calculated_balance;
END;
$$;

-- Also mark any "completed" withdrawals made with fake money as voided
-- by changing their status and adding a note
UPDATE public.transactions
SET status = 'failed',
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"voided_reason": "made_with_fake_balance"}'::jsonb
WHERE user_id = '16a381b4-baad-442a-b163-1135e986abb7'
  AND type = 'withdrawal'
  AND status = 'completed'
  AND created_at < '2026-02-03';  -- Before today (when real money started)

-- Execute reconciliation for admin user
SELECT reconcile_wallet_from_stripe_deposits('16a381b4-baad-442a-b163-1135e986abb7');
