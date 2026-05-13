-- Enable Realtime for wallets and wallet_transactions
alter publication supabase_realtime add table wallets;
alter publication supabase_realtime add table wallet_transactions;
