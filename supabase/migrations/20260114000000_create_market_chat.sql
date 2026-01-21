CREATE TABLE IF NOT EXISTS public.market_chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id uuid NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id),
    content text NOT NULL CHECK (char_length(content) <= 500),
    created_at timestamptz DEFAULT now()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_market_chat_market_created 
  ON public.market_chat_messages(market_id, created_at DESC);

-- RLS
ALTER TABLE public.market_chat_messages ENABLE ROW LEVEL SECURITY;

-- Read: anyone can read messages on public markets
CREATE POLICY "Read public market chat" ON public.market_chat_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.markets WHERE id = market_id AND is_public = true)
  );

-- Insert: authenticated users on public markets only
CREATE POLICY "Send messages on public markets" ON public.market_chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.markets WHERE id = market_id AND is_public = true)
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.market_chat_messages;
