// @ts-nocheck: This is a workaround to allow the use of the Stripe API in the Deno runtime.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2022-11-15",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { amount, userId: requestedUserId } = await req.json(); // amount in cents

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const authHeader = req.headers.get("authorization") ??
      req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getUser(
      token,
    );
    const userId = authData?.user?.id;
    if (authError || !userId) {
      return new Response(
        JSON.stringify({ error: "Invalid JWT", details: authError?.message }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (requestedUserId && requestedUserId !== userId) {
      return new Response(JSON.stringify({ error: "User mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get user's wallet to get stripe_account_id and check balance
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("balance, stripe_account_id, total_withdrawn")
      .eq("user_id", userId)
      .maybeSingle();

    if (walletError || !wallet || !wallet.stripe_account_id) {
      throw new Error("Wallet not found or not connected to Stripe");
    }

    const amountInDollars = amount / 100;
    if (wallet.balance < amountInDollars) {
      throw new Error("Insufficient balance");
    }

    // 2. Perform Stripe Transfer to the Connected Account
    // Deduct 1.75% withdrawal fee from the transfer amount
    // User pays the full amount from balance, but receives 98.25%
    const withdrawalFeePercent = 0.0175;
    const transferAmount = Math.floor(amount * (1 - withdrawalFeePercent)); // amount in cents

    try {
      const transfer = await stripe.transfers.create({
        amount: transferAmount, // amount in cents (after fee)
        currency: "usd",
        destination: wallet.stripe_account_id,
        metadata: {
          userId: userId,
          type: "payout",
        },
      });

      // 3. Log the Payout Request in Supabase as completed
      const { data: payoutRequest, error: payoutError } = await supabase
        .from("payout_requests")
        .insert({
          user_id: userId,
          amount: amountInDollars,
          status: "completed",
          bank_details: { stripe_transfer_id: transfer.id },
        })
        .select()
        .single();

      if (payoutError) throw payoutError;

      // 4. Deduct from Supabase wallet balance
      const newBalance = Number(wallet.balance) - amountInDollars;
      const newTotalWithdrawn = Number(wallet.total_withdrawn ?? 0) +
        amountInDollars;
      const { error: updateError } = await supabase
        .from("wallets")
        .update({
          balance: newBalance,
          total_withdrawn: newTotalWithdrawn,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({
          success: true,
          payoutRequest,
          transferId: transfer.id,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } catch (stripeError) {
      console.error("Stripe Transfer Error:", stripeError);
      throw new Error(`Stripe Transfer failed: ${stripeError.message}`);
    }
  } catch (error) {
    console.error("Error in payout:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
