-- Add country column to wallets table
DO $$ BEGIN
    ALTER TABLE public.wallets ADD COLUMN country text DEFAULT 'US';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;
