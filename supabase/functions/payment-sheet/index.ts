// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"; // <-- Add this line

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2022-11-15",
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { amount, email, userId } = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get or create Stripe Customer
    let { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    let customerId = wallet?.stripe_customer_id;

    if (!customerId) {
      // Search for existing customer by email in Stripe
      const existingCustomers = await stripe.customers.list({
        email: email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: email,
          metadata: { userId },
        });
        customerId = customer.id;
      }

      // Create or Update wallet with customer ID
      if (!wallet) {
        await supabase
          .from("wallets")
          .insert({
            user_id: userId,
            stripe_customer_id: customerId,
            balance: 0,
            is_virtual: true
          });
      } else {
        await supabase
          .from("wallets")
          .update({ stripe_customer_id: customerId })
          .eq("user_id", userId);
      }
    }

    // 2. Create Ephemeral Key
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: "2022-11-15" }
    );

    // 3. Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: "usd",
      customer: customerId,
      setup_future_usage: "off_session", // Save the card for future use
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId: userId,
        type: "wallet_topup",
      },
    });

    return new Response(
      JSON.stringify({
        paymentIntent: paymentIntent.client_secret,
        ephemeralKey: ephemeralKey.secret,
        customer: customerId,
        publishableKey: Deno.env.get("STRIPE_PUBLISHABLE_KEY") ?? "",
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Error in payment-sheet:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});

