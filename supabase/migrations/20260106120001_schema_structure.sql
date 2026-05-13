-- Create enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE public.market_status AS ENUM ('open', 'closed', 'resolved', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create tables
CREATE TABLE IF NOT EXISTS public.users (
    id uuid PRIMARY KEY REFERENCES auth.users(id),
    username text,
    avatar_url text,
    created_at timestamptz DEFAULT now(),
    email text,
    stripe_customer_id text
);

CREATE TABLE IF NOT EXISTS public.groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text,
    admin_id uuid REFERENCES public.users(id),
    created_at timestamptz DEFAULT now(),
    share_code text UNIQUE,
    description text
);

CREATE TABLE IF NOT EXISTS public.group_members (
    group_id uuid REFERENCES public.groups(id),
    user_id uuid REFERENCES public.users(id),
    joined_at timestamptz DEFAULT now(),
    role text DEFAULT 'member',
    PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.invites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid REFERENCES public.groups(id),
    created_by uuid REFERENCES public.users(id),
    code text UNIQUE,
    expires_at timestamptz,
    used boolean DEFAULT false,
    used_by uuid REFERENCES public.users(id),
    used_at timestamptz,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wallets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid UNIQUE REFERENCES public.users(id),
    balance numeric DEFAULT 0 CHECK (balance >= 0),
    currency text DEFAULT 'USD',
    is_virtual boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    stripe_customer_id text,
    stripe_account_id text
);

CREATE TABLE IF NOT EXISTS public.markets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid REFERENCES public.groups(id),
    creator_id uuid REFERENCES public.users(id),
    question text,
    description text,
    closes_at timestamptz,
    resolved_at timestamptz,
    winning_option_id uuid,
    status public.market_status DEFAULT 'open',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id uuid REFERENCES public.markets(id),
    label text,
    total_pool numeric DEFAULT 0 CHECK (total_pool >= 0),
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.users(id),
    market_id uuid REFERENCES public.markets(id),
    option_id uuid REFERENCES public.options(id),
    amount numeric CHECK (amount > 0),
    placed_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid REFERENCES public.groups(id),
    user_id uuid REFERENCES public.users(id),
    content text,
    message_type text DEFAULT 'text',
    market_id uuid REFERENCES public.markets(id),
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.users(id),
    wallet_id uuid REFERENCES public.wallets(id),
    type text CHECK (type = ANY (ARRAY['topup', 'spend', 'refund', 'payout'])),
    amount numeric,
    stripe_payment_intent_id text,
    status text DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending', 'completed', 'failed'])),
    metadata jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.users(id),
    amount numeric,
    type text CHECK (type = ANY (ARRAY['deposit', 'withdrawal', 'bet_placed', 'bet_won', 'bet_refund'])),
    status text DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending', 'completed', 'failed'])),
    reference_id text,
    metadata jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payout_requests (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id uuid REFERENCES public.users(id),
    amount numeric,
    status text DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending', 'completed', 'failed', 'cancelled'])),
    bank_details jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Foreign Keys for markets
DO $$ BEGIN
    ALTER TABLE public.markets 
        ADD CONSTRAINT options_market_id_fkey 
        FOREIGN KEY (winning_option_id) 
        REFERENCES public.options(id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
