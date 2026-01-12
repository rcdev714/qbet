-- Add RLS policies for Wallets
CREATE POLICY "Users can view their own wallet" ON public.wallets
  FOR SELECT USING (auth.uid() = user_id);

-- Add RLS policies for Wallet Transactions
CREATE POLICY "Users can view their own transactions" ON public.wallet_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Add RLS policies for Payout Requests
CREATE POLICY "Users can view their own payout requests" ON public.payout_requests
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert payout requests" ON public.payout_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
