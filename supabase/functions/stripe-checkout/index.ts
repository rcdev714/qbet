// @ts-nocheck: Deno edge runtime uses remote imports resolved by deno.json.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";
import { assertComplianceGate } from "../_shared/compliance.ts";
import {
  buildAllowedOrigins,
  parsePositiveIntegerCents,
  resolveAllowedUrl,
} from "../_shared/payment-hardening.ts";

const createLogger = (functionName: string) => {
  const log = (
    level: string,
    message: string,
    context: Record<string, unknown> = {},
  ) => {
    const prefix = `[${functionName}]`;
    const logFn = level === "ERROR"
      ? console.error
      : level === "WARN"
      ? console.warn
      : console.log;
    logFn(
      `${prefix} ${message}`,
      Object.keys(context).length > 0 ? JSON.stringify(context) : "",
    );
  };

  return {
    info: (msg: string, ctx?: Record<string, unknown>) => log("INFO", msg, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>) => log("WARN", msg, ctx),
    error: (msg: string, ctx?: Record<string, unknown>) =>
      log("ERROR", msg, ctx),
  };
};

const logger = createLogger("stripe-checkout");

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

logger.info("🚀 Stripe Checkout handler initialized", {
  hasSecretKey: !!stripeSecretKey,
  secretKeyPrefix: stripeSecretKey.substring(0, 7),
});

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2022-11-15",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function allowedOrigins() {
  return buildAllowedOrigins([
    Deno.env.get("EXPO_PUBLIC_APP_URL"),
    Deno.env.get("APP_URL"),
    "https://anymarkt.com",
  ]);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      amount,
      userId: requestedUserId,
      successUrl,
      cancelUrl,
    } = await req.json();
    const amountCents = parsePositiveIntegerCents(amount);

    logger.info("📥 Request received", {
      amount: amountCents / 100,
      requestedUserId,
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("authorization") ??
      req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
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

    await assertComplianceGate(supabase, {
      userId,
      action: "stripe_deposit",
      amount: amountCents / 100,
      provider: "stripe",
    });

    // Verify user exists
    const { data: wallet } = await supabase
      .from("wallets")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    // Get or create Stripe Customer
    let customerId = wallet?.stripe_customer_id;

    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
        logger.info("✅ Customer verified in Stripe", { customerId });
      } catch {
        logger.warn("Customer not found in Stripe, will create new one", {
          customerId,
        });
        customerId = null;
      }
    }

    if (!customerId) {
      // Get user email
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      const email = userData?.user?.email;

      const customer = await stripe.customers.create({
        email: email,
        metadata: { userId },
      });
      customerId = customer.id;
      logger.info("✨ Created new Stripe customer", { customerId, email });

      // Update wallet with customer ID
      if (wallet) {
        await supabase
          .from("wallets")
          .update({ stripe_customer_id: customerId })
          .eq("user_id", userId);
      } else {
        await supabase.from("wallets").insert({
          user_id: userId,
          stripe_customer_id: customerId,
          balance: 0,
          is_virtual: true,
        });
      }
    }

    // Determine return URLs
    const origin = Deno.env.get("EXPO_PUBLIC_APP_URL") ||
      Deno.env.get("APP_URL") ||
      "https://anymarkt.com";

    const defaultSuccessUrl =
      `${origin}/topup?success=true&session_id={CHECKOUT_SESSION_ID}`;
    const defaultCancelUrl = `${origin}/topup?canceled=true`;
    const origins = allowedOrigins();
    const finalSuccessUrl = resolveAllowedUrl(
      successUrl,
      defaultSuccessUrl,
      origins,
    );
    const finalCancelUrl = resolveAllowedUrl(
      cancelUrl,
      defaultCancelUrl,
      origins,
    );

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Wallet Top Up",
              description: "Add funds to your Qbet wallet",
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
      metadata: {
        userId: userId,
        type: "wallet_topup",
      },
      // IMPORTANT: Stripe does NOT copy session metadata to the PaymentIntent.
      // We must explicitly pass metadata via payment_intent_data so that the
      // payment_intent.succeeded webhook handler can identify this as a wallet topup.
      payment_intent_data: {
        metadata: {
          userId: userId,
          type: "wallet_topup",
          source: "checkout",
        },
      },
    });

    logger.info("✅ Created Checkout Session", {
      sessionId: session.id,
      amount: amountCents / 100,
      livemode: session.livemode,
    });

    return new Response(
      JSON.stringify({
        url: session.url,
        sessionId: session.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    logger.error("❌ Checkout error", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
