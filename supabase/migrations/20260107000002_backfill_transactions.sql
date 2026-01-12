-- Backfill Deposits and Withdrawals from wallet_transactions
INSERT INTO public.transactions (user_id, amount, type, status, created_at)
SELECT 
    wt.user_id, 
    wt.amount, 
    CASE 
        WHEN wt.type = 'deposit' THEN 'deposit'
        WHEN wt.type = 'withdrawal' THEN 'withdrawal'
        ELSE wt.type 
    END, 
    'completed', 
    wt.created_at
FROM public.wallet_transactions wt
WHERE NOT EXISTS (
    SELECT 1 FROM public.transactions t 
    WHERE t.created_at = wt.created_at AND t.user_id = wt.user_id AND t.amount = wt.amount
);

-- Backfill Bets
INSERT INTO public.transactions (user_id, amount, type, status, metadata, created_at)
SELECT 
    b.user_id, 
    -b.amount, -- Bets are deductions
    'bet_placed', 
    'completed', 
    jsonb_build_object(
        'market_question', m.question,
        'option_label', o.label,
        'bet_id', b.id,
        'market_id', b.market_id
    ), 
    b.placed_at
FROM public.bets b
JOIN public.markets m ON b.market_id = m.id
JOIN public.options o ON b.option_id = o.id
WHERE NOT EXISTS (
    SELECT 1 FROM public.transactions t 
    WHERE t.metadata->>'bet_id' = b.id::text
);

-- Note: We can't easily backfill "winnings" accurately without re-calculating everything or having a record of payouts.
-- However, if there are existing payouts in wallet_transactions (type='payout'?), we could migrate them.
-- Assuming wallet_transactions might handle payouts if they were logged there.
