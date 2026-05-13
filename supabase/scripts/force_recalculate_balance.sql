/**
 * SQL Script to FORCE Reset Balance to Match Transaction History
 * WARNING: This script calculates the strict sum of all 'completed' transactions.
 * 
 * !!! DANGER !!!
 * If you manually added funds using the Admin Panel (which does NOT create transaction records)
 * or deleted transactions, YOUR BALANCE WILL BE INCORRECT (potentially NEGATIVE).
 * 
 * ONLY USE THIS IF YOU ARE CERTAIN YOUR TRANSACTION HISTORY IS COMPLETE.V
 */

DO $$
DECLARE
    -- !!! VERIFY THIS EMAIL !!!
    v_user_email text := 'juan.salgador@uisek.edu.ec'; 
    v_user_id uuid;
    v_history_sum numeric;
    v_current_balance numeric;
BEGIN
    -- 1. Find the User ID
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_user_email;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User % not found', v_user_email;
    END IF;

    -- 2. Get Current Balance
    SELECT balance INTO v_current_balance FROM public.wallets WHERE user_id = v_user_id;

    -- 3. Calculate Strict Historical Sum
    -- Sums all completed, non-play-mode transactions.
    -- Remember: 'bet_placed' is negative, 'deposit'/'bet_won' is positive.
    SELECT COALESCE(SUM(amount), 0) INTO v_history_sum
    FROM public.transactions
    WHERE user_id = v_user_id
    AND status = 'completed'
    AND (is_play_mode IS NULL OR is_play_mode = FALSE);

    -- 4. Report Discrepancy
    RAISE NOTICE 'User: %', v_user_email;
    RAISE NOTICE 'Current Wallet Balance: $%', v_current_balance;
    RAISE NOTICE 'Calculated Historial Sum: $%', v_history_sum;
    RAISE NOTICE 'Difference: $%', v_current_balance - v_history_sum;
    
    -- 5. SAFETY CHECK: Only update if explicitly uncommented/force logic
    -- By default, just report. UNCOMMENT BELOW TO APPLY.
    
    /* 
    UPDATE public.wallets
    SET balance = v_history_sum, updated_at = now()
    WHERE user_id = v_user_id;
    
    RAISE NOTICE 'SUCCESS: Wallet balance overwritten with historical sum ($%)', v_history_sum;
    */
    
    RAISE NOTICE 'NOTE: Set logic is currently commented out for safety. Uncomment lines 43-47 to apply.';
END $$;
