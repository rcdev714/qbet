-- Migration: Resolution Transparency
-- Created: 2026-02-02
-- Phase 1 of ontology improvements: market_resolution_proofs and disputes tables

-- ============================================================================
-- Table: market_resolution_proofs
-- Stores evidence and notes for each market resolution
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.market_resolution_proofs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
    resolver_id UUID NOT NULL REFERENCES public.users(id),
    winning_option_id UUID NOT NULL REFERENCES public.options(id),
    evidence_url TEXT,           -- URL to proof source (news article, official result, etc.)
    evidence_notes TEXT,         -- Admin explanation of resolution decision
    resolved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Each market can only have one proof
    CONSTRAINT market_resolution_proofs_unique_market UNIQUE (market_id)
);

-- Index for fast lookup by market
CREATE INDEX IF NOT EXISTS idx_resolution_proofs_market ON public.market_resolution_proofs(market_id);

-- Index for resolver history
CREATE INDEX IF NOT EXISTS idx_resolution_proofs_resolver ON public.market_resolution_proofs(resolver_id);

-- Enable RLS
ALTER TABLE public.market_resolution_proofs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Anyone can view proofs (transparency!)
CREATE POLICY "Anyone can view resolution proofs"
    ON public.market_resolution_proofs
    FOR SELECT
    USING (true);

-- Only the resolve functions (SECURITY DEFINER) can insert proofs
-- No direct insert policy for users

-- ============================================================================
-- Table: disputes
-- Allows users to challenge market resolutions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
    challenger_id UUID NOT NULL REFERENCES public.users(id),
    reason TEXT NOT NULL,
    evidence_url TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'upheld', 'overturned', 'dismissed')),
    admin_response TEXT,
    resolved_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    
    -- Prevent duplicate disputes from same user on same market
    CONSTRAINT disputes_unique_user_market UNIQUE (market_id, challenger_id)
);

-- Index for pending disputes (admin dashboard)
CREATE INDEX IF NOT EXISTS idx_disputes_pending ON public.disputes(status) WHERE status = 'pending';

-- Index by market
CREATE INDEX IF NOT EXISTS idx_disputes_market ON public.disputes(market_id);

-- Index by challenger
CREATE INDEX IF NOT EXISTS idx_disputes_challenger ON public.disputes(challenger_id);

-- Enable RLS
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for disputes
-- Anyone can view disputes (transparency)
CREATE POLICY "Anyone can view disputes"
    ON public.disputes
    FOR SELECT
    USING (true);

-- Authenticated users can submit disputes for markets they bet on
CREATE POLICY "Users can submit disputes for markets they bet on"
    ON public.disputes
    FOR INSERT
    WITH CHECK (
        auth.uid() = challenger_id
        AND EXISTS (
            SELECT 1 FROM public.bets 
            WHERE bets.user_id = auth.uid() 
            AND bets.market_id = disputes.market_id
        )
    );

-- ============================================================================
-- Function: submit_dispute
-- Authenticated RPC for submitting a dispute
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_dispute(
    p_market_id UUID,
    p_reason TEXT,
    p_evidence_url TEXT DEFAULT NULL
)
RETURNS public.disputes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_market public.markets;
    v_dispute public.disputes;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Verify market exists and is resolved
    SELECT * INTO v_market FROM public.markets WHERE id = p_market_id;
    IF v_market.id IS NULL THEN
        RAISE EXCEPTION 'Market not found';
    END IF;
    
    IF v_market.status <> 'resolved' THEN
        RAISE EXCEPTION 'Can only dispute resolved markets';
    END IF;

    -- Verify user placed a bet on this market
    IF NOT EXISTS (
        SELECT 1 FROM public.bets 
        WHERE user_id = v_user_id AND market_id = p_market_id
    ) THEN
        RAISE EXCEPTION 'Only users who bet on this market can file disputes';
    END IF;

    -- Check for existing dispute
    IF EXISTS (
        SELECT 1 FROM public.disputes 
        WHERE market_id = p_market_id AND challenger_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'You have already disputed this market';
    END IF;

    -- Create dispute
    INSERT INTO public.disputes (market_id, challenger_id, reason, evidence_url)
    VALUES (p_market_id, v_user_id, p_reason, p_evidence_url)
    RETURNING * INTO v_dispute;

    RETURN v_dispute;
END;
$function$;

-- ============================================================================
-- Function: resolve_dispute (admin only)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_dispute(
    p_dispute_id UUID,
    p_status TEXT,
    p_admin_response TEXT DEFAULT NULL
)
RETURNS public.disputes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_admin BOOLEAN;
    v_dispute public.disputes;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Verify admin
    SELECT is_admin INTO v_is_admin FROM public.users WHERE id = v_user_id;
    IF v_is_admin IS NOT TRUE THEN
        RAISE EXCEPTION 'Only admins can resolve disputes';
    END IF;

    -- Validate status
    IF p_status NOT IN ('upheld', 'overturned', 'dismissed') THEN
        RAISE EXCEPTION 'Invalid dispute status';
    END IF;

    -- Update dispute
    UPDATE public.disputes
    SET status = p_status,
        admin_response = p_admin_response,
        resolved_by = v_user_id,
        resolved_at = now()
    WHERE id = p_dispute_id
    RETURNING * INTO v_dispute;

    IF v_dispute.id IS NULL THEN
        RAISE EXCEPTION 'Dispute not found';
    END IF;

    RETURN v_dispute;
END;
$function$;

-- ============================================================================
-- Function: get_resolution_proof
-- Get the resolution proof for a market
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_resolution_proof(p_market_id UUID)
RETURNS public.market_resolution_proofs
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
    SELECT * FROM public.market_resolution_proofs WHERE market_id = p_market_id;
$function$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.submit_dispute(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_dispute(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_resolution_proof(UUID) TO authenticated, anon;
