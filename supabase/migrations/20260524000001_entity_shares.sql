-- Generalized entity share tracking for profiles, groups, bets, and market activity links

CREATE TABLE IF NOT EXISTS public.entity_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('profile', 'group', 'bets', 'bet')),
    entity_id TEXT NOT NULL,
    share_code TEXT NOT NULL UNIQUE,
    platform TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_entity_shares_entity
    ON public.entity_shares(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_shares_code
    ON public.entity_shares(share_code);
ALTER TABLE public.entity_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view entity shares"
    ON public.entity_shares
    FOR SELECT
    USING (true);
CREATE POLICY "Anyone can create entity shares"
    ON public.entity_shares
    FOR INSERT
    WITH CHECK (true);
CREATE OR REPLACE FUNCTION public.generate_entity_share_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_code TEXT;
    v_exists BOOLEAN;
BEGIN
    LOOP
        v_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));

        SELECT EXISTS(
            SELECT 1 FROM public.market_shares WHERE share_code = v_code
            UNION ALL
            SELECT 1 FROM public.entity_shares WHERE share_code = v_code
        ) INTO v_exists;

        EXIT WHEN NOT v_exists;
    END LOOP;

    RETURN v_code;
END;
$$;
CREATE OR REPLACE FUNCTION public.track_entity_share(
    p_entity_type TEXT,
    p_entity_id TEXT,
    p_platform TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_share_code TEXT;
    v_user_id UUID;
BEGIN
    IF p_entity_type NOT IN ('profile', 'group', 'bets', 'bet') THEN
        RAISE EXCEPTION 'Unsupported entity type: %', p_entity_type;
    END IF;

    v_user_id := auth.uid();
    v_share_code := public.generate_entity_share_code();

    INSERT INTO public.entity_shares (user_id, entity_type, entity_id, share_code, platform)
    VALUES (v_user_id, p_entity_type, p_entity_id, v_share_code, p_platform);

    RETURN v_share_code;
END;
$$;
GRANT EXECUTE ON FUNCTION public.track_entity_share(TEXT, TEXT, TEXT) TO authenticated, anon;
