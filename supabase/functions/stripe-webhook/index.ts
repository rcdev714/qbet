// @ts-nocheck
// Deno runtime - Supabase Edge Functions run on Deno, not Node.js
// TypeScript cannot resolve Deno URL imports, so we disable type checking here
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2022-11-15",
  httpClient: Stripe.createFetchHttpClient(),
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (req: Request) => {
  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();

  let event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "",
      undefined,
      cryptoProvider
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return new Response(errorMessage, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;
    const { userId, type } = paymentIntent.metadata;

    if (type === "wallet_topup" && userId) {
      const amount = paymentIntent.amount; // in cents
      const amountInDollars = amount / 100;

      // Initialize Supabase client
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // 1. Get user's wallet
      const { data: wallet, error: fetchError } = await supabase
        .from("wallets")
        .select("id, balance, total_deposited")
        .eq("user_id", userId)
        .single();

      if (fetchError) {
        console.error("Error fetching wallet:", fetchError);
        return new Response("Error fetching wallet", { status: 500 });
      }

      if (wallet) {
        // 2. Update Supabase wallet balance
        // Funds land in your platform balance automatically.
        const newBalance = Number(wallet.balance) + amountInDollars;
        const newTotalDeposited = Number(wallet.total_deposited || 0) + amountInDollars;

        const { error: updateError } = await supabase
          .from("wallets")
          .update({ balance: newBalance, total_deposited: newTotalDeposited, is_virtual: false })
          .eq("user_id", userId);

        // Log transaction
        await supabase.from("transactions").insert({
          user_id: userId,
          type: "deposit",
          amount: amountInDollars,
          status: "completed",
          reference_id: paymentIntent.id,
          metadata: paymentIntent,
        });

        if (updateError) {
          console.error("Error updating wallet:", updateError);
          return new Response("Error updating wallet", { status: 500 });
        }
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});

