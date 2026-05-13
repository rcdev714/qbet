-- Function to handle bet notifications
CREATE OR REPLACE FUNCTION public.handle_bet_placed_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_option_label text;
    v_is_public_market boolean;
BEGIN
    -- Check if it's a public market
    SELECT is_public INTO v_is_public_market 
    FROM public.markets 
    WHERE id = NEW.market_id;

    -- Only proceed for public markets
    IF v_is_public_market THEN
        -- Get the option label
        SELECT label INTO v_option_label 
        FROM public.options 
        WHERE id = NEW.option_id;

        -- Insert the notification message
        INSERT INTO public.market_chat_messages (market_id, user_id, content)
        VALUES (
            NEW.market_id, 
            NEW.user_id, 
            'bet $' || trim(to_char(NEW.amount, '9999999990.00')) || ' on ' || v_option_label
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run after a bet is inserted
CREATE TRIGGER tr_bet_placed_notification
AFTER INSERT ON public.bets
FOR EACH ROW
EXECUTE FUNCTION public.handle_bet_placed_notification();
