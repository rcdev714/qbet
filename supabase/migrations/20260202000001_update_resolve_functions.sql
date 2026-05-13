-- Migration: Update resolve functions to accept evidence parameters
-- Created: 2026-02-02
-- Updates both resolve_public_market and resolve_market to store resolution proofs

-- ============================================================================
-- Update resolve_public_market to accept evidence and store proof
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_public_market(
    p_market_id UUID,
    p_winning_option_id UUID,
    p_evidence_url TEXT DEFAULT NULL,
    p_evidence_notes TEXT DEFAULT NULL
)
RETURNS public.markets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_admin BOOLEAN;
    v_market public.markets;
    v_option RECORD;
    v_bet RECORD;
    v_total_pool NUMERIC;
    v_winning_pool NUMERIC;
    v_winning_side TEXT;
    c_vig NUMERIC := 0.0795;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 1. Verify user is an app admin
    SELECT is_admin INTO v_is_admin FROM public.users WHERE id = v_user_id;
    IF v_is_admin IS NOT TRUE THEN
        RAISE EXCEPTION 'Only app admins can resolve public markets';
    END IF;

    -- 2. Get and lock the market
    SELECT * INTO v_market FROM public.markets m WHERE m.id = p_market_id FOR UPDATE;
    IF v_market.id IS NULL THEN
        RAISE EXCEPTION 'Market not found';
    END IF;

    -- 3. Verify this is a public market
    IF v_market.is_public IS NOT TRUE THEN
        RAISE EXCEPTION 'This function only resolves public markets. Use resolve_market for group markets.';
    END IF;

    IF v_market.status = 'resolved' THEN
        RAISE EXCEPTION 'Market already resolved';
    END IF;

    -- 4. Store the resolution proof BEFORE processing payouts
    INSERT INTO public.market_resolution_proofs (
        market_id,
        resolver_id,
        winning_option_id,
        evidence_url,
        evidence_notes
    ) VALUES (
        p_market_id,
        v_user_id,
        p_winning_option_id,
        p_evidence_url,
        p_evidence_notes
    );

    -- 5. If there were no bets on anything, just close it
    SELECT SUM(total_pool) INTO v_total_pool FROM public.options WHERE market_id = p_market_id;
    IF v_total_pool = 0 OR v_total_pool IS NULL THEN
        UPDATE public.markets
        SET status = 'resolved', resolved_at = now(), winning_option_id = p_winning_option_id
        WHERE id = p_market_id
        RETURNING * INTO v_market;
        RETURN v_market;
    END IF;

    -- 6. Resolve each option independently (YES wins for winning option, NO wins otherwise)
    FOR v_option IN
        SELECT id, label, yes_pool, no_pool
        FROM public.options
        WHERE market_id = p_market_id
    LOOP
        DECLARE
            v_loser_pool NUMERIC;
            v_loser_pool_after_vig NUMERIC;
        BEGIN
            v_winning_side := CASE WHEN v_option.id = p_winning_option_id THEN 'yes' ELSE 'no' END;
            v_winning_pool := CASE WHEN v_winning_side = 'yes' THEN v_option.yes_pool ELSE v_option.no_pool END;
            v_loser_pool := CASE WHEN v_winning_side = 'yes' THEN v_option.no_pool ELSE v_option.yes_pool END;
            v_loser_pool_after_vig := COALESCE(v_loser_pool, 0) * (1 - c_vig);

            FOR v_bet IN
                SELECT b.id, b.user_id, b.amount, b.side
                FROM public.bets b
                WHERE b.market_id = p_market_id AND b.option_id = v_option.id
            LOOP
                DECLARE
                    v_payout_amount NUMERIC := 0;
                    v_type TEXT := 'bet_lost';
                BEGIN
                    IF v_bet.side = v_winning_side AND v_winning_pool > 0 THEN
                        v_payout_amount := v_bet.amount + (v_bet.amount / v_winning_pool) * v_loser_pool_after_vig;
                        v_type := 'bet_won';

                        UPDATE public.wallets
                        SET balance = balance + v_payout_amount
                        WHERE user_id = v_bet.user_id;
                    END IF;

                    INSERT INTO public.transactions (user_id, amount, type, status, metadata)
                    VALUES (
                        v_bet.user_id,
                        v_payout_amount,
                        v_type,
                        'completed',
                        jsonb_build_object(
                            'market_question', v_market.question,
                            'option_label', v_option.label,
                            'bet_id', v_bet.id,
                            'wager', v_bet.amount,
                            'side', v_bet.side,
                            'market_type', 'public'
                        )
                    );
                END;
            END LOOP;
        END;
    END LOOP;

    -- 7. Update market status
    UPDATE public.markets
    SET status = 'resolved',
        resolved_at = now(),
        winning_option_id = p_winning_option_id
    WHERE id = p_market_id
    RETURNING * INTO v_market;

    RETURN v_market;
END;
$function$;

-- ============================================================================
-- Update resolve_market (group markets) to accept evidence and store proof
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_market(
    p_market_id UUID,
    p_winning_option_id UUID,
    p_evidence_url TEXT DEFAULT NULL,
    p_evidence_notes TEXT DEFAULT NULL
)
RETURNS public.markets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_market public.markets;
    v_option RECORD;
    v_bet RECORD;
    v_total_pool NUMERIC;
    v_winning_pool NUMERIC;
    v_winning_side TEXT;
    c_vig NUMERIC := 0.0795;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 1. Get and lock the market
    SELECT * INTO v_market FROM public.markets m WHERE m.id = p_market_id FOR UPDATE;
    IF v_market.id IS NULL THEN
        RAISE EXCEPTION 'Market not found';
    END IF;

    -- 2. Verify admin rights
    IF NOT EXISTS (
        SELECT 1 FROM public.group_members 
        WHERE group_id = v_market.group_id 
          AND user_id = v_user_id 
          AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Only group admins can resolve markets';
    END IF;

    IF v_market.status = 'resolved' THEN
        RAISE EXCEPTION 'Market already resolved';
    END IF;

    -- 3. Store the resolution proof BEFORE processing payouts
    INSERT INTO public.market_resolution_proofs (
        market_id,
        resolver_id,
        winning_option_id,
        evidence_url,
        evidence_notes
    ) VALUES (
        p_market_id,
        v_user_id,
        p_winning_option_id,
        p_evidence_url,
        p_evidence_notes
    );

    -- 4. If there were no bets on anything, just close it
    SELECT SUM(total_pool) INTO v_total_pool FROM public.options WHERE market_id = p_market_id;
    IF v_total_pool = 0 OR v_total_pool IS NULL THEN
        UPDATE public.markets
        SET status = 'resolved', resolved_at = now(), winning_option_id = p_winning_option_id
        WHERE id = p_market_id
        RETURNING * INTO v_market;
        RETURN v_market;
    END IF;

    -- 5. Resolve each option independently (YES wins for winning option, NO wins otherwise)
    FOR v_option IN
        SELECT id, label, yes_pool, no_pool
        FROM public.options
        WHERE market_id = p_market_id
    LOOP
        DECLARE
            v_loser_pool NUMERIC;
            v_loser_pool_after_vig NUMERIC;
        BEGIN
            v_winning_side := CASE WHEN v_option.id = p_winning_option_id THEN 'yes' ELSE 'no' END;
            v_winning_pool := CASE WHEN v_winning_side = 'yes' THEN v_option.yes_pool ELSE v_option.no_pool END;
            v_loser_pool := CASE WHEN v_winning_side = 'yes' THEN v_option.no_pool ELSE v_option.yes_pool END;
            v_loser_pool_after_vig := COALESCE(v_loser_pool, 0) * (1 - c_vig);

            FOR v_bet IN
                SELECT b.id, b.user_id, b.amount, b.side
                FROM public.bets b
                WHERE b.market_id = p_market_id AND b.option_id = v_option.id
            LOOP
                DECLARE
                    v_payout_amount NUMERIC := 0;
                    v_type TEXT := 'bet_lost';
                BEGIN
                    IF v_bet.side = v_winning_side AND v_winning_pool > 0 THEN
                        v_payout_amount := v_bet.amount + (v_bet.amount / v_winning_pool) * v_loser_pool_after_vig;
                        v_type := 'bet_won';

                        UPDATE public.wallets
                        SET balance = balance + v_payout_amount
                        WHERE user_id = v_bet.user_id;
                    END IF;

                    INSERT INTO public.transactions (user_id, amount, type, status, metadata)
                    VALUES (
                        v_bet.user_id,
                        v_payout_amount,
                        v_type,
                        'completed',
                        jsonb_build_object(
                            'market_question', v_market.question,
                            'option_label', v_option.label,
                            'bet_id', v_bet.id,
                            'wager', v_bet.amount,
                            'side', v_bet.side,
                            'market_type', 'private'
                        )
                    );
                END;
            END LOOP;
        END;
    END LOOP;

    -- 6. Update market status
    UPDATE public.markets
    SET status = 'resolved',
        resolved_at = now(),
        winning_option_id = p_winning_option_id
    WHERE id = p_market_id
    RETURNING * INTO v_market;

    RETURN v_market;
END;
$function$;

-- Grant execute permissions (already granted, but ensure they exist)
GRANT EXECUTE ON FUNCTION public.resolve_public_market(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_market(UUID, UUID, TEXT, TEXT) TO authenticated;
