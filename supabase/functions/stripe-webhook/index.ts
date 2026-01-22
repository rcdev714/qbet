// @ts-nocheck: Deno edge runtime uses remote imports resolved by deno.json.
// Deno runtime - Supabase Edge Functions run on Deno, not Node.js
// TypeScript cannot resolve Deno URL imports, so we disable type checking here
import { createClient } from "@supabase/supabase-js";
import { serve } from "std/http/server.ts";
import Stripe from "stripe";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2022-11-15",
  httpClient: Stripe.createFetchHttpClient(),
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getTransactionByReference = async (referenceId: string) => {
  const { data, error } = await supabase
    .from("transactions")
    .select("id, status")
    .eq("reference_id", referenceId)
    .maybeSingle();

  if (error) {
    console.error("Error checking transaction:", error);
    return null;
  }

  return data;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();

  if (!signature) {
    return jsonResponse({ error: "Missing Stripe-Signature header" }, 400);
  }

  let event: Stripe.Event;

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
    return jsonResponse({ error: errorMessage }, 400);
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const { userId, type } = paymentIntent.metadata ?? {};

        if (type !== "wallet_topup" || !userId) {
          console.warn("PaymentIntent missing metadata:", paymentIntent.id);
          break;
        }

        const existingTx = await getTransactionByReference(paymentIntent.id);
        if (existingTx?.status === "completed") {
          break;
        }

        const amountInDollars = (paymentIntent.amount_received ?? paymentIntent.amount) / 100;

        const { data: wallet, error: fetchError } = await supabase
          .from("wallets")
          .select("id, balance, total_deposited")
          .eq("user_id", userId)
          .maybeSingle();

        if (fetchError || !wallet) {
          console.error("Error fetching wallet:", fetchError);
          break;
        }

        const newBalance = Number(wallet.balance ?? 0) + amountInDollars;
        const newTotalDeposited = Number(wallet.total_deposited ?? 0) + amountInDollars;

        const { error: updateError } = await supabase
          .from("wallets")
          .update({
            balance: newBalance,
            total_deposited: newTotalDeposited,
            is_virtual: false,
          })
          .eq("user_id", userId);

        if (updateError) {
          console.error("Error updating wallet:", updateError);
          break;
        }

        if (existingTx?.id) {
          await supabase
            .from("transactions")
            .update({
              type: "deposit",
              amount: amountInDollars,
              status: "completed",
              metadata: {
                stripe_payment_intent_id: paymentIntent.id,
                currency: paymentIntent.currency,
                livemode: paymentIntent.livemode,
              },
            })
            .eq("id", existingTx.id);
        } else {
          await supabase.from("transactions").insert({
            user_id: userId,
            type: "deposit",
            amount: amountInDollars,
            status: "completed",
            reference_id: paymentIntent.id,
            metadata: {
              stripe_payment_intent_id: paymentIntent.id,
              currency: paymentIntent.currency,
              livemode: paymentIntent.livemode,
            },
          });
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const { userId } = paymentIntent.metadata ?? {};
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
            },
          });
        }
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const userId = account.metadata?.userId;
        if (userId) {
          console.log(
            `Account ${account.id} updated for ${userId}: details_submitted=${account.details_submitted}, payouts_enabled=${account.payouts_enabled}`
          );
        }
        break;
      }

      case "transfer.reversed": {
        const transfer = event.data.object as Stripe.Transfer;
        const userId = transfer.metadata?.userId;
        if (!userId) {
          console.warn("Transfer reversed without userId metadata:", transfer.id);
          break;
        }

        const existingTx = await getTransactionByReference(transfer.id);
        const amountInDollars = transfer.amount / 100;

        if (existingTx?.id) {
          await supabase
            .from("transactions")
            .update({
              status: "failed",
              metadata: {
                stripe_transfer_id: transfer.id,
                failure_code: transfer.reversals?.data?.[0]?.failure_code ?? null,
                livemode: transfer.livemode,
              },
            })
            .eq("id", existingTx.id);
        } else {
          await supabase.from("transactions").insert({
            user_id: userId,
            type: "withdrawal",
            amount: amountInDollars,
            status: "failed",
            reference_id: transfer.id,
            metadata: {
              stripe_transfer_id: transfer.id,
              livemode: transfer.livemode,
            },
          });
        }
        break;
      }

      case "payout.failed": {
        const payout = event.data.object as Stripe.Payout;
        const userId = payout.metadata?.userId;
        if (!userId) {
          console.warn("Payout failed without userId metadata:", payout.id);
          break;
        }

        const existingTx = await getTransactionByReference(payout.id);
        const amountInDollars = payout.amount / 100;

        if (existingTx?.id) {
          await supabase
            .from("transactions")
            .update({
              status: "failed",
              metadata: {
                stripe_payout_id: payout.id,
                failure_code: payout.failure_code,
                failure_message: payout.failure_message,
                livemode: payout.livemode,
              },
            })
            .eq("id", existingTx.id);
        } else {
          await supabase.from("transactions").insert({
            user_id: userId,
            type: "withdrawal",
            amount: amountInDollars,
            status: "failed",
            reference_id: payout.id,
            metadata: {
              stripe_payout_id: payout.id,
              failure_code: payout.failure_code,
              failure_message: payout.failure_message,
              livemode: payout.livemode,
            },
          });
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const refundAmount = (charge.amount_refunded ?? 0) / 100;
        if (refundAmount <= 0) break;

        const paymentIntentId = charge.payment_intent as string | null;
        let userId = charge.metadata?.userId;

        if (!userId && paymentIntentId) {
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
          userId = paymentIntent.metadata?.userId;
        }

        if (!userId) {
          console.warn("Charge refunded without userId metadata:", charge.id);
          break;
        }

        const existingTx = await getTransactionByReference(charge.id);
        if (existingTx) break;

        const { data: wallet, error: fetchError } = await supabase
          .from("wallets")
          .select("id, balance, total_deposited")
          .eq("user_id", userId)
          .maybeSingle();

        if (fetchError || !wallet) {
          console.error("Error fetching wallet for refund:", fetchError);
          break;
        }

        const updatedBalanceRaw = Number(wallet.balance ?? 0) - refundAmount;
        const updatedBalance = Math.max(0, updatedBalanceRaw);
        if (updatedBalanceRaw < 0) {
          console.warn("Refund would make balance negative, clamping to 0:", userId);
        }

        const updatedTotalDeposited = Math.max(
          0,
          Number(wallet.total_deposited ?? 0) - refundAmount
        );

        const { error: updateError } = await supabase
          .from("wallets")
          .update({
            balance: updatedBalance,
            total_deposited: updatedTotalDeposited,
          })
          .eq("user_id", userId);

        if (updateError) {
          console.error("Error updating wallet for refund:", updateError);
          break;
        }

        await supabase.from("transactions").insert({
          user_id: userId,
          type: "deposit",
          amount: -refundAmount,
          status: "completed",
          reference_id: charge.id,
          metadata: {
            stripe_charge_id: charge.id,
            stripe_payment_intent_id: paymentIntentId,
            refund: true,
            livemode: charge.livemode,
          },
        });
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`Error processing ${event.type}:`, error);
  }

  return jsonResponse({ received: true });
});

