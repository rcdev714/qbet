// @ts-nocheck: Deno edge runtime uses remote imports resolved by deno.json.
// Deno runtime - Supabase Edge Functions run on Deno, not Node.js
// TypeScript cannot resolve Deno URL imports, so we disable type checking here
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";

// ============================================================================
// STRIPE LOGGER - Centralized logging for payment operations
// ============================================================================

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

interface LogContext {
  [key: string]: unknown;
}

const createLogger = (functionName: string) => {
  const log = (level: LogLevel, message: string, context: LogContext = {}) => {
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
    debug: (msg: string, ctx?: LogContext) => log("DEBUG", msg, ctx),
    info: (msg: string, ctx?: LogContext) => log("INFO", msg, ctx),
    warn: (msg: string, ctx?: LogContext) => log("WARN", msg, ctx),
    error: (msg: string, ctx?: LogContext) => log("ERROR", msg, ctx),
    event: (type: string, id: string, livemode: boolean, ctx?: LogContext) =>
      log("INFO", `📩 Event: ${type}`, { eventId: id, livemode, ...ctx }),
    success: (op: string, ctx?: LogContext) => log("INFO", `✅ ${op}`, ctx),
    failure: (op: string, error: Error, ctx?: LogContext) =>
      log("ERROR", `❌ ${op}: ${error.message}`, {
        ...ctx,
        errorName: error.name,
      }),
    balance: (
      type: "credit" | "debit",
      amount: number,
      userId: string,
      ctx?: LogContext,
    ) =>
      log(
        "INFO",
        `${type === "credit" ? "💰" : "💸"} Wallet ${type}: $${
          amount.toFixed(2)
        }`,
        { userId, amount, ...ctx },
      ),
  };
};

const logger = createLogger("stripe-webhook");

// ============================================================================
// STRIPE & SUPABASE INITIALIZATION
// ============================================================================

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

// Log startup info (once)
logger.info("🚀 Webhook handler initialized", {
  hasSecretKey: !!stripeSecretKey,
  secretKeyPrefix: stripeSecretKey.substring(0, 7),
  hasWebhookSecret: !!webhookSecret,
});

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2022-11-15",
  httpClient: Stripe.createFetchHttpClient(),
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const recordStripeEvent = async (
  eventId: string,
  eventType: string,
  livemode: boolean | null,
) => {
  const { error } = await supabase.from("stripe_events").insert({
    id: eventId,
    type: eventType,
    livemode,
  });

  if (error) {
    if (error.code === "23505") {
      logger.warn("Duplicate event detected, skipping", { eventId, eventType });
      return false;
    }
    logger.error("Failed to record event", { eventId, error: error.message });
    throw error;
  }

  return true;
};

const getReferenceIdFromMetadata = (
  metadata?: Record<string, string | undefined | null>,
  fallbackId?: string,
) => {
  return metadata?.requestId || metadata?.request_id || fallbackId;
};

const getTransactionByReference = async (referenceId: string) => {
  const { data, error } = await supabase
    .from("transactions")
    .select("id, status")
    .eq("reference_id", referenceId)
    .maybeSingle();

  if (error) {
    logger.error("Error checking transaction", {
      referenceId,
      error: error.message,
    });
    return null;
  }

  return data;
};

const assertNoRpcError = (
  operation: string,
  error: { message: string } | null,
) => {
  if (error) {
    throw new Error(`${operation}: ${error.message}`);
  }
};

// ============================================================================
// WEBHOOK HANDLER
// ============================================================================

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();

  if (!signature) {
    logger.error("Missing Stripe-Signature header");
    return jsonResponse({ error: "Missing Stripe-Signature header" }, 400);
  }

  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      webhookSecret,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    logger.error("Signature verification failed", { error: errorMessage });
    return jsonResponse({ error: errorMessage }, 400);
  }

  // Log every event received
  logger.event(event.type, event.id, event.livemode ?? false);

  try {
    switch (event.type) {
      // ======================================================================
      // PAYMENT INTENT EVENTS
      // ======================================================================

      case "payment_intent.created": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logger.info("PaymentIntent created", {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          userId: paymentIntent.metadata?.userId,
          livemode: paymentIntent.livemode,
        });
        break;
      }

      case "payment_intent.processing": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logger.info("PaymentIntent processing", {
          paymentIntentId: paymentIntent.id,
          userId: paymentIntent.metadata?.userId,
          livemode: paymentIntent.livemode,
        });
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const { userId, type, source } = paymentIntent.metadata ?? {};

        logger.info("PaymentIntent succeeded", {
          paymentIntentId: paymentIntent.id,
          amount: (paymentIntent.amount_received ?? paymentIntent.amount) / 100,
          currency: paymentIntent.currency,
          userId,
          type,
          source,
          livemode: paymentIntent.livemode,
        });

        if (type !== "wallet_topup" || !userId) {
          logger.warn(
            "PaymentIntent missing metadata, skipping wallet update",
            {
              paymentIntentId: paymentIntent.id,
              hasUserId: !!userId,
              type,
            },
          );
          break;
        }

        const amountInDollars =
          (paymentIntent.amount_received ?? paymentIntent.amount) / 100;

        const metadata = {
          stripe_payment_intent_id: paymentIntent.id,
          currency: paymentIntent.currency,
          livemode: paymentIntent.livemode,
          stripe_event_id: event.id,
          source: source || "payment_sheet",
        };

        const { error: topupError } = await supabase.rpc("apply_wallet_topup", {
          p_user_id: userId,
          p_amount: amountInDollars,
          p_reference_id: paymentIntent.id,
          p_event_id: event.id,
          p_metadata: metadata,
        });

        assertNoRpcError("Wallet topup", topupError);
        logger.balance("credit", amountInDollars, userId, {
          paymentIntentId: paymentIntent.id,
          livemode: paymentIntent.livemode,
        });
        break;
      }

      case "payment_intent.payment_failed": {
        const shouldProcess = await recordStripeEvent(
          event.id,
          event.type,
          event.livemode ?? null,
        );
        if (!shouldProcess) {
          break;
        }

        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const { userId } = paymentIntent.metadata ?? {};

        logger.warn("PaymentIntent failed", {
          paymentIntentId: paymentIntent.id,
          userId,
          errorCode: paymentIntent.last_payment_error?.code,
          errorMessage: paymentIntent.last_payment_error?.message,
          livemode: paymentIntent.livemode,
        });

        if (!userId) break;

        const existingTx = await getTransactionByReference(paymentIntent.id);
        if (existingTx?.status === "completed") {
          break;
        }

        const amountInDollars = paymentIntent.amount / 100;

        if (existingTx?.id) {
          await supabase
            .from("transactions")
            .update({
              type: "deposit",
              amount: amountInDollars,
              status: "failed",
              metadata: {
                stripe_payment_intent_id: paymentIntent.id,
                error: paymentIntent.last_payment_error?.message,
                livemode: paymentIntent.livemode,
                stripe_event_id: event.id,
              },
            })
            .eq("id", existingTx.id);
        } else {
          await supabase.from("transactions").insert({
            user_id: userId,
            type: "deposit",
            amount: amountInDollars,
            status: "failed",
            reference_id: paymentIntent.id,
            metadata: {
              stripe_payment_intent_id: paymentIntent.id,
              error: paymentIntent.last_payment_error?.message,
              livemode: paymentIntent.livemode,
              stripe_event_id: event.id,
            },
          });
        }
        break;
      }

      case "payment_intent.canceled": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logger.info("PaymentIntent canceled", {
          paymentIntentId: paymentIntent.id,
          userId: paymentIntent.metadata?.userId,
          cancellationReason: paymentIntent.cancellation_reason,
          livemode: paymentIntent.livemode,
        });
        break;
      }

      // ======================================================================
      // CHARGE EVENTS
      // ======================================================================

      case "charge.succeeded": {
        const charge = event.data.object as Stripe.Charge;
        logger.info("Charge succeeded", {
          chargeId: charge.id,
          amount: charge.amount / 100,
          paymentIntentId: charge.payment_intent,
          livemode: charge.livemode,
        });
        break;
      }

      case "charge.failed": {
        const charge = event.data.object as Stripe.Charge;
        logger.warn("Charge failed", {
          chargeId: charge.id,
          amount: charge.amount / 100,
          failureCode: charge.failure_code,
          failureMessage: charge.failure_message,
          livemode: charge.livemode,
        });
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const refundAmount = (charge.amount_refunded ?? 0) / 100;

        logger.info("Charge refunded", {
          chargeId: charge.id,
          refundAmount,
          paymentIntentId: charge.payment_intent,
          livemode: charge.livemode,
        });

        if (refundAmount <= 0) break;

        const paymentIntentId = charge.payment_intent as string | null;
        let userId = charge.metadata?.userId;

        if (!userId && paymentIntentId) {
          const paymentIntent = await stripe.paymentIntents.retrieve(
            paymentIntentId,
          );
          userId = paymentIntent.metadata?.userId;
        }

        if (!userId) {
          logger.warn("Charge refunded without userId metadata", {
            chargeId: charge.id,
          });
          break;
        }

        const metadata = {
          stripe_charge_id: charge.id,
          stripe_payment_intent_id: paymentIntentId,
          refund: true,
          livemode: charge.livemode,
          stripe_event_id: event.id,
        };

        const { error: refundError } = await supabase.rpc(
          "apply_wallet_refund",
          {
            p_user_id: userId,
            p_amount: refundAmount,
            p_reference_id: charge.id,
            p_event_id: event.id,
            p_metadata: metadata,
          },
        );

        assertNoRpcError("Wallet refund", refundError);
        logger.balance("debit", refundAmount, userId, {
          chargeId: charge.id,
          reason: "refund",
          livemode: charge.livemode,
        });
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        logger.warn("🚨 Dispute created", {
          disputeId: dispute.id,
          amount: dispute.amount / 100,
          reason: dispute.reason,
          chargeId: dispute.charge,
          livemode: dispute.livemode,
        });
        break;
      }

      // ======================================================================
      // CONNECT ACCOUNT EVENTS
      // ======================================================================

      case "account.updated": {
        const shouldProcess = await recordStripeEvent(
          event.id,
          event.type,
          event.livemode ?? null,
        );
        if (!shouldProcess) {
          break;
        }

        const account = event.data.object as Stripe.Account;
        const userId = account.metadata?.userId;

        logger.info("Connect account updated", {
          accountId: account.id,
          userId,
          detailsSubmitted: account.details_submitted,
          payoutsEnabled: account.payouts_enabled,
          chargesEnabled: account.charges_enabled,
          disabledReason: account.requirements?.disabled_reason,
          livemode: event.livemode,
        });
        break;
      }

      case "account.application.authorized": {
        const application = event.data.object;
        logger.info("Account application authorized", { application });
        break;
      }

      case "account.application.deauthorized": {
        const application = event.data.object;
        logger.warn("Account application deauthorized", { application });
        break;
      }

      // ======================================================================
      // TRANSFER EVENTS
      // ======================================================================

      case "transfer.created": {
        const transfer = event.data.object as Stripe.Transfer;
        logger.info("Transfer created", {
          transferId: transfer.id,
          amount: transfer.amount / 100,
          destination: transfer.destination,
          livemode: transfer.livemode,
        });
        break;
      }

      case "transfer.reversed": {
        const shouldProcess = await recordStripeEvent(
          event.id,
          event.type,
          event.livemode ?? null,
        );
        if (!shouldProcess) {
          break;
        }

        const transfer = event.data.object as Stripe.Transfer;
        const referenceId = getReferenceIdFromMetadata(
          transfer.metadata,
          transfer.id,
        );

        logger.warn("Transfer reversed", {
          transferId: transfer.id,
          amount: transfer.amount / 100,
          referenceId,
          livemode: transfer.livemode,
        });

        if (!referenceId) {
          logger.warn("Transfer reversed without reference metadata", {
            transferId: transfer.id,
          });
          break;
        }

        const { error: withdrawalFailureError } = await supabase.rpc(
          "fail_wallet_withdrawal",
          {
          p_reference_id: referenceId,
          p_failure_code: transfer.reversals?.data?.[0]?.failure_code ??
            "transfer_reversed",
          p_failure_message: transfer.reversals?.data?.[0]?.failure_message ??
            null,
          p_metadata: {
            stripe_transfer_id: transfer.id,
            livemode: transfer.livemode,
          },
          },
        );
        assertNoRpcError("Transfer reversal reconciliation", withdrawalFailureError);
        break;
      }

      case "transfer.canceled": {
        const transfer = event.data.object as Stripe.Transfer;
        logger.warn("Transfer canceled", {
          transferId: transfer.id,
          amount: transfer.amount / 100,
          livemode: transfer.livemode,
        });
        break;
      }

      // ======================================================================
      // PAYOUT EVENTS
      // ======================================================================

      case "payout.created": {
        const payout = event.data.object as Stripe.Payout;
        logger.info("Payout created", {
          payoutId: payout.id,
          amount: payout.amount / 100,
          arrivalDate: payout.arrival_date,
          livemode: payout.livemode,
        });
        break;
      }

      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout;
        logger.success("Payout completed", {
          payoutId: payout.id,
          amount: payout.amount / 100,
          livemode: payout.livemode,
        });
        break;
      }

      case "payout.failed": {
        const shouldProcess = await recordStripeEvent(
          event.id,
          event.type,
          event.livemode ?? null,
        );
        if (!shouldProcess) {
          break;
        }

        const payout = event.data.object as Stripe.Payout;
        const referenceId = getReferenceIdFromMetadata(
          payout.metadata,
          payout.id,
        );

        logger.failure(
          "Payout failed",
          new Error(payout.failure_message || "Unknown"),
          {
            payoutId: payout.id,
            amount: payout.amount / 100,
            failureCode: payout.failure_code,
            referenceId,
            livemode: payout.livemode,
          },
        );

        if (!referenceId) {
          logger.warn("Payout failed without reference metadata", {
            payoutId: payout.id,
          });
          break;
        }

        const { error: payoutFailureError } = await supabase.rpc(
          "fail_wallet_withdrawal",
          {
          p_reference_id: referenceId,
          p_failure_code: payout.failure_code ?? "payout_failed",
          p_failure_message: payout.failure_message ?? null,
          p_metadata: {
            stripe_payout_id: payout.id,
            livemode: payout.livemode,
          },
          },
        );
        assertNoRpcError("Payout failure reconciliation", payoutFailureError);
        break;
      }

      case "payout.canceled": {
        const payout = event.data.object as Stripe.Payout;
        logger.warn("Payout canceled", {
          payoutId: payout.id,
          amount: payout.amount / 100,
          livemode: payout.livemode,
        });
        break;
      }

      // ======================================================================
      // CUSTOMER EVENTS (for visibility)
      // ======================================================================

      case "customer.created": {
        const customer = event.data.object as Stripe.Customer;
        logger.info("Customer created", {
          customerId: customer.id,
          email: customer.email,
          livemode: customer.livemode,
        });
        break;
      }

      case "customer.updated": {
        const customer = event.data.object as Stripe.Customer;
        logger.info("Customer updated", {
          customerId: customer.id,
          livemode: customer.livemode,
        });
        break;
      }

      // ======================================================================
      // CHECKOUT SESSION EVENTS (Web payments)
      // ======================================================================

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const { userId, type } = session.metadata ?? {};

        logger.info("Checkout session completed", {
          sessionId: session.id,
          amount: (session.amount_total ?? 0) / 100,
          paymentStatus: session.payment_status,
          paymentIntentId: session.payment_intent,
          userId,
          type,
          livemode: session.livemode,
        });

        // NOTE: Wallet crediting is handled by payment_intent.succeeded.
        // The Checkout Session now passes metadata to the PaymentIntent via
        // payment_intent_data.metadata, so payment_intent.succeeded has all
        // the info it needs. This handler is kept for logging/auditing only
        // to avoid double-crediting the wallet.
        break;
      }

      // ======================================================================
      // DEFAULT HANDLER
      // ======================================================================

      default:
        logger.debug(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    logger.failure(
      `Processing ${event.type}`,
      error instanceof Error ? error : new Error(String(error)),
      {
        eventId: event.id,
      },
    );
    return jsonResponse({
      error: "Webhook processing failed",
      eventId: event.id,
    }, 500);
  }

  return jsonResponse({ received: true });
});
