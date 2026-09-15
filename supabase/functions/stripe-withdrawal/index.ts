// @ts-nocheck: Stripe Global Payouts v2 API for cross-border withdrawals
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { assertComplianceGate } from "../_shared/compliance.ts";
import { parsePositiveIntegerCents } from "../_shared/payment-hardening.ts";
import {
  recipientBankCapabilities,
  stripeV2Request,
} from "../_shared/stripe-global-payouts.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, idempotency-key",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let idempotencyKey: string | null = null;
  let reservedWithdrawal = false;
  let outboundPaymentAccepted = false;
  let supabase: ReturnType<typeof createClient> | null = null;

  try {
    const appUrl = Deno.env.get("EXPO_PUBLIC_APP_URL") ||
      Deno.env.get("APP_URL") || "https://anymarkt.com";
    const authHeader = req.headers.get("authorization") ??
      req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { userId: requestedUserId, amount, requestId, returnPath } = await req
      .json(); // amount in cents
    const amountCents = parsePositiveIntegerCents(amount);
    idempotencyKey = req.headers.get("idempotency-key") ?? requestId ??
      crypto.randomUUID();
    const normalizedReturnPath =
      typeof returnPath === "string" && returnPath.startsWith("/")
        ? returnPath
        : "/wallet";
    const returnBase = `${appUrl}${normalizedReturnPath}`;

    console.log("[stripe-withdrawal] Request received:", {
      requestedUserId,
      amount,
      requestId: idempotencyKey,
    });

    // Initialize Supabase Admin Client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: authData, error: authError } = await supabase.auth.getUser(
      token,
    );
    const authedUserId = authData?.user?.id;

    if (authError || !authedUserId) {
      return jsonResponse(
        { error: "Invalid JWT", details: authError?.message },
        401,
      );
    }

    if (requestedUserId && authedUserId !== requestedUserId) {
      return jsonResponse({ error: "User mismatch", authedUserId }, 403);
    }
    const userId = authedUserId;

    await assertComplianceGate(supabase, {
      userId,
      action: "withdrawal",
      amount: amountCents / 100,
      provider: "stripe",
    });

    // 1. Get user's wallet
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (walletError || !wallet) {
      console.error("Wallet query error:", walletError);
      throw new Error("Wallet not found");
    }

    const email = authData.user?.email;
    const userName = authData.user?.user_metadata?.full_name ||
      authData.user?.user_metadata?.name || email?.split("@")[0] || "User";
    const payoutCountry = (wallet.country || "US").toLowerCase();

    if (!email) {
      throw new Error("User email not found");
    }

    // Check Balance
    // Use integers (cents) for comparison to avoid floating point issues
    const balanceCents = Math.round(Number(wallet.balance) * 100);

    if (balanceCents < amountCents) {
      throw new Error(
        `Insufficient balance. Available: $${wallet.balance}, Requested: $${
          amountCents / 100
        }`,
      );
    }

    // Check for existing transaction with this idempotency key
    const existingTx = await supabase
      .from("transactions")
      .select("id, status, metadata")
      .eq("reference_id", idempotencyKey)
      .eq("type", "withdrawal")
      .maybeSingle();

    if (existingTx.error) {
      throw new Error(
        `Failed to check existing withdrawal: ${existingTx.error.message}`,
      );
    }

    if (existingTx.data?.status === "completed") {
      const transferId = existingTx.data.metadata?.stripe_transfer_id ?? null;
      return jsonResponse({
        status: "sent",
        transferId,
        requestId: idempotencyKey,
      }, 200);
    }

    // 2. Check if user has a Global Payouts recipient account
    if (!wallet.global_recipient_id) {
      console.log(
        `[Stripe Withdrawal] Creating Global Payouts recipient for ${email}`,
      );

      // Create recipient using v2 API
      const createResponse = await stripeV2Request(
        STRIPE_SECRET_KEY,
        "/v2/core/accounts",
        "POST",
        {
          contact_email: email,
          display_name: userName,
          identity: {
            country: payoutCountry,

            entity_type: "individual",
          },
          configuration: {
            recipient: {
              capabilities: {
                bank_accounts: recipientBankCapabilities(payoutCountry),
              },
            },
          },
          include: ["identity", "configuration.recipient", "requirements"],
        },
        undefined,
        `${idempotencyKey}:create-recipient`,
      );

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        console.error("Failed to create recipient:", errorData);
        throw new Error(
          errorData.error?.message || "Failed to create recipient account",
        );
      }

      const recipient = await createResponse.json();
      console.log("[Stripe Withdrawal] Created recipient:", recipient.id);

      // Update Wallet with new recipient ID
      const { error: updateError } = await supabase
        .from("wallets")
        .update({ global_recipient_id: recipient.id })
        .eq("user_id", userId);

      if (updateError) {
        console.error(
          "Failed to update wallet with global_recipient_id:",
          updateError,
        );
        throw new Error("Failed to link recipient account");
      }

      // Create Account Link for bank account onboarding

      const linkResponse = await stripeV2Request(
        STRIPE_SECRET_KEY,
        "/v2/core/account_links",
        "POST",
        {
          account: recipient.id,
          use_case: {
            type: "account_onboarding",
            account_onboarding: {
              configurations: ["recipient"],
              return_url: `${returnBase}?onboarding=complete`,
              refresh_url: `${returnBase}?onboarding=refresh`,
            },
          },
        },
        undefined,
        `${idempotencyKey}:recipient-onboarding-link`,
      );

      if (!linkResponse.ok) {
        const linkError = await linkResponse.json();
        console.error(
          "Failed to create account link:",
          JSON.stringify(linkError),
        );

        // Fallback: Return the Stripe dashboard URL for managing this recipient
        // Users can add bank account details via Stripe's email or dashboard
        return jsonResponse({
          needsOnboarding:
            `https://dashboard.stripe.com/global-payouts/recipients/${recipient.id}`,
          message:
            "Complete your payout setup in Stripe. Check your email for instructions.",
          requestId: idempotencyKey,
        }, 200);
      }

      const accountLink = await linkResponse.json();

      return jsonResponse({
        needsOnboarding: accountLink.url,
        requestId: idempotencyKey,
      }, 200);
    }

    // 3. Check if user has a payout method set up — try fetching from Stripe first
    let payoutMethodId = wallet.payout_method_id;

    if (!payoutMethodId) {
      console.log(
        `[Stripe Withdrawal] payout_method_id missing, querying Stripe for existing payout methods...`,
      );

      // Query Stripe for payout methods using recipient context
      const pmResponse = await stripeV2Request(
        STRIPE_SECRET_KEY,
        "/v2/money_management/payout_methods",
        "GET",
        undefined,
        wallet.global_recipient_id, // Stripe-Context header
      );

      if (pmResponse.ok) {
        const pmData = await pmResponse.json();
        const methods = pmData.data || [];
        console.log(
          `[Stripe Withdrawal] Found ${methods.length} payout methods`,
        );

        if (methods.length > 0) {
          // Pick the first active payout method
          payoutMethodId = methods[0].id;
          console.log(
            `[Stripe Withdrawal] Using payout method: ${payoutMethodId}`,
          );

          // Persist it so we don't have to look it up every time
          const { error: pmUpdateError } = await supabase
            .from("wallets")
            .update({ payout_method_id: payoutMethodId })
            .eq("user_id", userId);

          if (pmUpdateError) {
            console.error(
              "Failed to persist payout_method_id:",
              pmUpdateError,
            );
            // Non-fatal — we can still proceed with the payout
          }
        }
      } else {
        const pmError = await pmResponse.json();
        console.error(
          "[Stripe Withdrawal] Failed to list payout methods:",
          JSON.stringify(pmError),
        );
      }
    }

    // Still no payout method → try account_update link (account may already be onboarded)
    if (!payoutMethodId) {
      console.log(
        `[Stripe Withdrawal] No payout methods found, creating account link...`,
      );

      // Try account_update first (works for already-onboarded accounts)
      let linkResponse = await stripeV2Request(
        STRIPE_SECRET_KEY,
        "/v2/core/account_links",
        "POST",
        {
          account: wallet.global_recipient_id,
          use_case: {
            type: "account_update",
            account_update: {
              configurations: ["recipient"],
              return_url: `${returnBase}?onboarding=complete`,
              refresh_url: `${returnBase}?onboarding=refresh`,
            },
          },
        },
        undefined,
        `${idempotencyKey}:account-update-link`,
      );

      // If account_update fails, try account_onboarding as fallback
      if (!linkResponse.ok) {
        console.log(
          "[Stripe Withdrawal] account_update link failed, trying account_onboarding...",
        );
        linkResponse = await stripeV2Request(
        STRIPE_SECRET_KEY,
          "/v2/core/account_links",
          "POST",
          {
            account: wallet.global_recipient_id,
            use_case: {
              type: "account_onboarding",
              account_onboarding: {
                configurations: ["recipient"],
                return_url: `${returnBase}?onboarding=complete`,
                refresh_url: `${returnBase}?onboarding=refresh`,
              },
            },
          },
          undefined,
          `${idempotencyKey}:account-onboarding-link`,
        );
      }

      if (!linkResponse.ok) {
        const linkError = await linkResponse.json();
        console.error(
          "Failed to create any account link:",
          JSON.stringify(linkError),
        );

        return jsonResponse({
          needsOnboarding:
            `https://dashboard.stripe.com/global-payouts/recipients/${wallet.global_recipient_id}`,
          status: "payout_method_required",
          message:
            "Your account is set up but needs a bank account added. Please add your bank details in Stripe.",
          requestId: idempotencyKey,
        }, 200);
      }

      const accountLink = await linkResponse.json();

      return jsonResponse({
        needsOnboarding: accountLink.url,
        status: "payout_method_required",
        requestId: idempotencyKey,
      }, 200);
    }

    // 4. Verify recipient is ready for payouts
    const recipientResponse = await stripeV2Request(
        STRIPE_SECRET_KEY,
      `/v2/core/accounts/${wallet.global_recipient_id}?include[0]=configuration.recipient`,
      "GET",
    );

    if (!recipientResponse.ok) {
      throw new Error("Failed to verify recipient status");
    }

    const recipientData = await recipientResponse.json();
    const bankCaps = recipientData.configuration?.recipient?.capabilities
      ?.bank_accounts;
    const bankAccountsCapability =
      bankCaps?.wire?.status ?? bankCaps?.local?.status;

    if (bankAccountsCapability !== "active") {
      console.log(
        `[Stripe Withdrawal] Recipient not ready, capability status: ${bankAccountsCapability}`,
      );

      // Create Account Link for completing setup
      const linkResponse = await stripeV2Request(
        STRIPE_SECRET_KEY,
        "/v2/core/account_links",
        "POST",
        {
          account: wallet.global_recipient_id,
          use_case: {
            type: "account_onboarding",
            account_onboarding: {
              configurations: ["recipient"],
              return_url: `${returnBase}?onboarding=complete`,
              refresh_url: `${returnBase}?onboarding=refresh`,
            },
          },
        },
        undefined,
        `${idempotencyKey}:capability-onboarding-link`,
      );

      if (linkResponse.ok) {
        const accountLink = await linkResponse.json();
        return jsonResponse({
          needsOnboarding: accountLink.url,
          status: "onboarding_required",
          requestId: idempotencyKey,
        }, 200);
      } else {
        // Fallback: Return the Stripe dashboard URL
        return jsonResponse({
          needsOnboarding:
            `https://dashboard.stripe.com/global-payouts/recipients/${wallet.global_recipient_id}`,
          status: "onboarding_required",
          message: "Complete your payout setup in Stripe.",
          requestId: idempotencyKey,
        }, 200);
      }
    }

    console.log(
      `[Stripe Withdrawal] Initiating payout to recipient ${wallet.global_recipient_id}`,
    );

    // Fee calculation (same as before)
    const amountDollars = amountCents / 100;
    const rawFeePercent = 0.41 / Math.pow(amountDollars, 0.44);
    const feePercentage = Math.min(0.15, Math.max(0.02, rawFeePercent));

    let feeAmount = Math.round(amountCents * feePercentage);
    if (feeAmount > amountCents) {
      feeAmount = amountCents;
    }

    const netTransferAmount = amountCents - feeAmount;
    const feeAmountDollars = feeAmount / 100;
    const netTransferAmountDollars = netTransferAmount / 100;

    // Reserve the withdrawal in the database
    const { data: reserved, error: reserveError } = await supabase.rpc(
      "reserve_wallet_withdrawal",
      {
        p_user_id: userId,
        p_amount: amountDollars,
        p_reference_id: idempotencyKey,
        p_metadata: {
          request_id: idempotencyKey,
          fee_amount: feeAmountDollars,
          net_amount: netTransferAmountDollars,
          fee_percentage: feePercentage,
        },
      },
    );

    if (reserveError) {
      throw new Error(`Withdrawal reservation failed: ${reserveError.message}`);
    }

    if (reserved === false) {
      return jsonResponse(
        { status: "pending", requestId: idempotencyKey },
        200,
      );
    }

    reservedWithdrawal = true;

    // 5. Create OutboundPayment using v2 API
    const paymentResponse = await stripeV2Request(
        STRIPE_SECRET_KEY,
      "/v2/money_management/outbound_payments",
      "POST",
      {
        amount: {
          value: netTransferAmountDollars.toFixed(2),
          currency: "usd",
        },
        payout_method: payoutMethodId,
        description: "Wallet withdrawal",
        metadata: {
          userId: userId,
          type: "withdrawal",
          originalAmount: amountCents.toString(),
          feeAmount: feeAmount.toString(),
          feePercentage: `${(feePercentage * 100).toFixed(2)}%`,
          requestId: idempotencyKey,
        },
      },
      wallet.global_recipient_id,
      `${idempotencyKey}:outbound-payment`,
    );

    if (!paymentResponse.ok) {
      const paymentError = await paymentResponse.json();
      console.error("Failed to create outbound payment:", paymentError);
      throw new Error(paymentError.error?.message || "Failed to send payment");
    }

    const payment = await paymentResponse.json();
    outboundPaymentAccepted = true;

    const { error: finalizeError } = await supabase.rpc(
      "finalize_wallet_withdrawal",
      {
        p_reference_id: idempotencyKey,
        p_transfer_id: payment.id,
        p_fee_amount: feeAmountDollars,
        p_net_amount: netTransferAmountDollars,
        p_metadata: {
          stripe_payment_id: payment.id,
          destination: wallet.global_recipient_id,
          fee_percentage: feePercentage,
        },
      },
    );

    if (finalizeError) {
      console.error(
        "[stripe-withdrawal] Finalization failed after Stripe accepted payout:",
        {
          requestId: idempotencyKey,
          stripePaymentId: payment.id,
          error: finalizeError.message,
        },
      );
      return jsonResponse({
        error:
          "Withdrawal sent but local finalization failed; reconciliation required.",
        code: "withdrawal_finalize_failed",
        transferId: payment.id,
        requestId: idempotencyKey,
      }, 500);
    }

    return jsonResponse({
      status: "sent",
      transferId: payment.id,
      requestId: idempotencyKey,
    }, 200);
  } catch (error) {
    console.error("Error in stripe-withdrawal:", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    if (
      reservedWithdrawal && !outboundPaymentAccepted && idempotencyKey &&
      supabase
    ) {
      const { error: failError } = await supabase.rpc(
        "fail_wallet_withdrawal",
        {
          p_reference_id: idempotencyKey,
          p_failure_code: "transfer_failed",
          p_failure_message: errorMessage,
          p_metadata: { failure_source: "stripe-withdrawal" },
        },
      );
      if (failError) {
        console.error("[stripe-withdrawal] Failed to mark withdrawal failed:", {
          requestId: idempotencyKey,
          error: failError.message,
        });
      }
    }
    return jsonResponse({ error: errorMessage }, 400);
  }
});
