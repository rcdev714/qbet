-- Migration: Categories System
-- Created: 2026-02-02
-- Phase 2 of ontology improvements: Dynamic taxonomy for markets

-- ============================================================================
-- Table: categories
-- Dynamic market categories replacing hardcoded FEED_CATEGORIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    icon TEXT,                    -- SF Symbol, emoji, or icon name
    color TEXT,                   -- Hex color for theming
    description TEXT,
    parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL, -- Hierarchical
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for active categories sorted by order
CREATE INDEX IF NOT EXISTS idx_categories_active ON public.categories(is_active, sort_order);

-- Index for hierarchical queries
CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories(parent_id);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Anyone can view categories
CREATE POLICY "Anyone can view categories"
    ON public.categories
    FOR SELECT
    USING (true);

-- Only admins can modify categories (via SECURITY DEFINER functions)

-- ============================================================================
-- Seed initial categories (migrate from hardcoded FEED_CATEGORIES)
-- ============================================================================

INSERT INTO public.categories (name, slug, icon, color, sort_order) VALUES
    ('Politics', 'politics', '🏛️', '#6366F1', 1),
    ('Tech', 'tech', '💻', '#10B981', 2),
    ('Entertainment', 'entertainment', '🎬', '#F59E0B', 3)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Add category_id FK to markets (optional, keeps backward compatibility)
-- ============================================================================

ALTER TABLE public.markets 
    ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- Index for filtering by category
CREATE INDEX IF NOT EXISTS idx_markets_category ON public.markets(category_id);

-- ============================================================================
-- Function: get_categories
-- Get all active categories ordered by sort_order
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_categories()
RETURNS SETOF public.categories
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
    SELECT * FROM public.categories 
    WHERE is_active = true 
    ORDER BY sort_order, name;
$function$;

-- ============================================================================
-- Function: create_category (admin only)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_category(
    p_name TEXT,
    p_slug TEXT,
    p_icon TEXT DEFAULT NULL,
    p_color TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_parent_id UUID DEFAULT NULL
)
RETURNS public.categories
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_admin BOOLEAN;
    v_category public.categories;
    v_max_order INT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT is_admin INTO v_is_admin FROM public.users WHERE id = v_user_id;
    IF v_is_admin IS NOT TRUE THEN
        RAISE EXCEPTION 'Only admins can create categories';
    END IF;

    -- Get max sort order
    SELECT COALESCE(MAX(sort_order), 0) INTO v_max_order FROM public.categories;

    INSERT INTO public.categories (name, slug, icon, color, description, parent_id, sort_order)
    VALUES (p_name, p_slug, p_icon, p_color, p_description, p_parent_id, v_max_order + 1)
    RETURNING * INTO v_category;

    RETURN v_category;
END;
$function$;

-- ============================================================================
-- Function: update_category (admin only)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_category(
    p_category_id UUID,
    p_name TEXT DEFAULT NULL,
    p_icon TEXT DEFAULT NULL,
    p_color TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL,
    p_sort_order INT DEFAULT NULL
)
RETURNS public.categories
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_admin BOOLEAN;
    v_category public.categories;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT is_admin INTO v_is_admin FROM public.users WHERE id = v_user_id;
    IF v_is_admin IS NOT TRUE THEN
        RAISE EXCEPTION 'Only admins can update categories';
    END IF;

    UPDATE public.categories
    SET name = COALESCE(p_name, name),
        icon = COALESCE(p_icon, icon),
        color = COALESCE(p_color, color),
        description = COALESCE(p_description, description),
        is_active = COALESCE(p_is_active, is_active),
        sort_order = COALESCE(p_sort_order, sort_order)
    WHERE id = p_category_id
    RETURNING * INTO v_category;

    IF v_category.id IS NULL THEN
        RAISE EXCEPTION 'Category not found';
    END IF;

    RETURN v_category;
END;
$function$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_categories() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_category(TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_category(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INT) TO authenticated;
