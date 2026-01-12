-- Create app_settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    description text,
    updated_at timestamptz DEFAULT now()
);

-- Insert default withdrawal fee (5%)
INSERT INTO public.app_settings (key, value, description)
VALUES 
    ('withdrawal_fee_percent', '0.05', 'Total withdrawal fee percentage (e.g., 0.05 for 5%)')
ON CONFLICT (key) DO UPDATE 
SET value = '0.05';

-- Add RLS policies (Public read, Admin write)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.app_settings;

CREATE POLICY "Allow public read access" ON public.app_settings
    FOR SELECT USING (true);

-- Assuming only service role or specific admins write, keeping it open for now or just public read.
-- For simplicity in this app, public read is key.
