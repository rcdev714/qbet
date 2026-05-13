-- This file was refactored into migrations.
-- See supabase/migrations/ for the schema definitions.
-- Add INSERT statements here for initial data seeding if needed.

-- Create a test user (password: password)
-- Create a test user (password: password)
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000000', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'authenticated', 'authenticated', 'test@example.com', '$2a$10$abcdefghijklmnopqrstuv', NOW(), '{"provider": "email", "providers": ["email"]}', '{"username": "TestUser", "avatar_url": "https://i.pravatar.cc/150?u=test"}', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, email, username, avatar_url)
VALUES 
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'test@example.com', 'TestUser', 'https://i.pravatar.cc/150?u=test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.wallets (user_id, balance, currency, is_virtual)
VALUES 
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 5000, 'USD', true)
ON CONFLICT (user_id) DO UPDATE SET balance = 5000;

-- Create a Group
INSERT INTO public.groups (id, name, share_code, description, admin_id)
VALUES 
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'Crypto Degens', 'CRYPTO', 'Predicting the future of finance', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.group_members (group_id, user_id, role)
VALUES 
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'admin')
ON CONFLICT (group_id, user_id) DO NOTHING;

-- Create a Market
INSERT INTO public.markets (id, group_id, creator_id, question, description, status, closes_at)
VALUES 
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Will BTC hit $100k in 2025?', 'Bitcoin price prediction for year end.', 'open', NOW() + INTERVAL '1 year')
ON CONFLICT (id) DO NOTHING;

-- Create Options
INSERT INTO public.options (id, market_id, label, total_pool)
VALUES 
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d44', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'Yes', 0),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e55', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'No', 0)
ON CONFLICT (id) DO NOTHING;

-- Insert fake transactions for history
INSERT INTO public.transactions (user_id, amount, type, status, metadata, created_at)
VALUES 
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 1000, 'deposit', 'completed', null, NOW() - INTERVAL '2 days'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -50, 'withdrawal', 'completed', null, NOW() - INTERVAL '1 day'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -100, 'bet_placed', 'completed', '{"market_question": "Will BTC hit $100k in 2025?", "option_label": "Yes"}', NOW() - INTERVAL '1 hour'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 0, 'bet_lost', 'completed', '{"market_question": "Will ETH flippen BTC?", "option_label": "Yes", "wager": 50}', NOW() - INTERVAL '30 minutes');
