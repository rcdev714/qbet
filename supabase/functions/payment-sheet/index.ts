// @ts-nocheck: Deno edge runtime uses remote imports resolved by deno.json.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";
import { assertComplianceGate } from "../_shared/compliance.ts";
import { parsePositiveIntegerCents } from "../_shared/payment-hardening.ts";

// ============================================================================
// LOGGER
// ============================================================================

const createLogger = (functionName: string) => {
  const log = (
    level: string,
    message: string,
    context: Record<string, unknown> = {},
  ) => {
    const livemode = context.livemode;
    const modeTag = livemode === true
      ? "🟢 LIVE"
      : livemode === false
      ? "🟡 TEST"
      : "";
    const prefix = `[${functionName}]${modeTag ? ` ${modeTag}` : ""}`;
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

const logger = createLogger("payment-sheet");

// ============================================================================
// INITIALIZATION
// ============================================================================

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const stripePublishableKey = Deno.env.get("STRIPE_PUBLISHABLE_KEY") ?? "";

// Log startup info
logger.info("🚀 Payment sheet handler initialized", {
  hasSecretKey: !!stripeSecretKey,
  secretKeyPrefix: stripeSecretKey.substring(0, 7),
  publishableKeyPrefix: stripePublishableKey.substring(0, 7),
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { amount, email, userId: requestedUserId, requestId } = await req
      .json();
    const amountCents = parsePositiveIntegerCents(amount);
    const idempotencyKey = requestId ?? crypto.randomUUID();

    logger.info("📥 Request received", {
      amount: amountCents / 100,
      email,
      requestedUserId,
      requestId: idempotencyKey,
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
    const resolvedEmail = email ?? authData.user?.email;
    if (!resolvedEmail) {
      throw new Error("Unable to determine user email");
    }

    await assertComplianceGate(supabase, {
      userId,
      action: "stripe_deposit",
      amount: amountCents / 100,
      provider: "stripe",
    });

    // 1. Get or create Stripe Customer
    const { data: wallet } = await supabase
      .from("wallets")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    let customerId = wallet?.stripe_customer_id;
    // Verify the customer exists in Stripe (may be stale from test mode)
    if (customerId) {
      try {
        const customer = await stripe.customers.retrieve(customerId);
        logger.info("✅ Customer verified in Stripe", {
          customerId,
          livemode: (customer as any).livemode,
        });
      } catch (error) {
        logger.warn("Customer not found in Stripe, will create new one", {
          customerId,
          error: error instanceof Error ? error.message : "Unknown",
        });
        customerId = null;
      }
    }

    if (!customerId) {
      // Search for existing customer by email in Stripe
      const existingCustomers = await stripe.customers.list({
        email: resolvedEmail,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id;
        logger.info("Found existing customer by email", {
          customerId,
          email: resolvedEmail,
        });
      } else {
        const customer = await stripe.customers.create({
          email: resolvedEmail,
          metadata: { userId },
        });
        customerId = customer.id;
        logger.info("✨ Created new Stripe customer", {
          customerId,
          email: resolvedEmail,
          livemode: customer.livemode,
        });
      }

      // Create or Update wallet with customer ID
      if (!wallet) {
        await supabase
          .from("wallets")
          .insert({
            user_id: userId,
            stripe_customer_id: customerId,
            balance: 0,
            is_virtual: true,
          });
        logger.info("Created wallet with customer ID", { userId, customerId });
      } else {
        await supabase
          .from("wallets")
          .update({ stripe_customer_id: customerId })
          .eq("user_id", userId);
        logger.info("Updated wallet with customer ID", { userId, customerId });
      }
    }

    // 2. Create Ephemeral Key
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: "2022-11-15" },
    );
    logger.info("🔑 Created ephemeral key", { customerId });

    // 3. Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      customer: customerId,
      setup_future_usage: "off_session", // Save the card for future use
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId: userId,
        type: "wallet_topup",
        requestId: idempotencyKey,
      },
    }, { idempotencyKey });

    logger.info("💳 Created PaymentIntent", {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      livemode: paymentIntent.livemode,
      userId,
    });

    return new Response(
      JSON.stringify({
        paymentIntent: paymentIntent.client_secret,
        ephemeralKey: ephemeralKey.secret,
        customer: customerId,
        publishableKey: stripePublishableKey,
        requestId: idempotencyKey,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    logger.error("❌ Payment sheet error", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
