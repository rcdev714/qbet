-- Add is_admin column to users table
ALTER TABLE users 
ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;

-- Create index for admin lookups (optional but good practice)
CREATE INDEX idx_users_is_admin ON users(is_admin) WHERE is_admin = TRUE;
