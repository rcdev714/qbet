-- Add unique constraint to username column in users table
-- We use a partial index if we want to allow multiple NULLs, 
-- but in this case, we want to ensure any SET username is unique.
-- Standard UNIQUE constraint in Postgres allows multiple NULLs by default.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'users_username_key'
    ) THEN
        ALTER TABLE public.users ADD CONSTRAINT users_username_key UNIQUE (username);
    END IF;
END $$;
