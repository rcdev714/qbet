-- Add fee columns to transactions table
ALTER TABLE "public"."transactions" 
ADD COLUMN IF NOT EXISTS "fee_amount" numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS "net_amount" numeric DEFAULT 0;

COMMENT ON COLUMN "public"."transactions"."fee_amount" IS 'Total fees deducted from the transaction';
COMMENT ON COLUMN "public"."transactions"."net_amount" IS 'Net amount transferred or received';
