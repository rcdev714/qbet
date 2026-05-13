-- Fix Missing $3.33 Deposit for Juan Salgador
-- This migration inserts a missing deposit transaction and updates the wallet balance.
-- The deposit was confirmed in Stripe but missing from the DB due to a webhook failure.

DO $$
DECLARE
    -- Using the confirmed email. If this runs on other environments, it will fail harmlessly (if user not found) 
    -- or credit the same email if it exists.
    v_user_email text := 'juan.salgador@uisek.edu.ec'; 
    v_amount numeric := 3.33;
    v_user_id uuid;
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_user_email;
    
    IF v_user_id IS NOT NULL THEN
        -- Check if transaction already exists (idempotency safety by verifying no recent similar deposit)
        IF NOT EXISTS (
            SELECT 1 FROM public.transactions 
            WHERE user_id = v_user_id 
            AND amount = v_amount 
            AND type = 'deposit' 
            AND created_at > (now() - interval '30 days')
            AND (metadata->>'note') = 'manual fix via migration 20260209'
        ) THEN
            -- Insert the Missing Transaction
            INSERT INTO public.transactions (
                user_id, 
                amount, 
                type, 
                status, 
                metadata,
                is_play_mode
            )
            VALUES (
                v_user_id, 
                v_amount, 
                'deposit', 
                'completed', 
                '{"note": "manual fix via migration 20260209", "source": "stripe_missing_webhook"}',
                false
            );

            -- Update the Wallet Balance
            UPDATE public.wallets 
            SET 
                balance = balance + v_amount, 
                total_deposited = COALESCE(total_deposited, 0) + v_amount,
                updated_at = now()
            WHERE user_id = v_user_id;

            RAISE NOTICE 'Applied fix: Credited $% to %', v_amount, v_user_email;
        ELSE
            RAISE NOTICE 'Fix skipped: Transaction already seems to exist for %', v_user_email;
        END IF;
    ELSE
        RAISE NOTICE 'Fix skipped: User % not found', v_user_email;
    END IF;
END $$;
