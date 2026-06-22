
CREATE OR REPLACE FUNCTION public.apply_wallet_topup(
  p_user_id uuid,
  p_amount numeric,
  p_reference_id text,
  p_event_id text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Record stripe event for idempotency (use actual event type from metadata if available)
  INSERT INTO public.stripe_events (id, type, livemode)
  VALUES (
    p_event_id,
    COALESCE(p_metadata->>'event_type', 'wallet_topup'),
    (p_metadata->>'livemode')::boolean
  )
  ON CONFLICT DO NOTHING;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.wallets
    SET balance = balance + p_amount,
        total_deposited = total_deposited + p_amount,
        is_virtual = false,
        updated_at = now()
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
  END IF;

  INSERT INTO public.transactions (
    user_id,
    type,
    amount,
    status,
    reference_id,
    metadata
  ) VALUES (
    p_user_id,
    'deposit',
    p_amount,
    'completed',
    p_reference_id,
    p_metadata
  )
  ON CONFLICT (reference_id, type) WHERE reference_id IS NOT NULL DO NOTHING;
END;
$function$;
;
