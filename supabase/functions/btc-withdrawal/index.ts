// @ts-nocheck: Provider-neutral BTC payout adapter for Supabase Edge runtime.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { assertComplianceGate } from "../_shared/compliance.ts";

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

function normalizeBtcAddress(value: unknown) {
  return String(value || "").trim();
}

function isLikelyBtcAddress(address: string) {
  return /^(bc1|tb1)[a-z0-9]{25,90}$/i.test(address) ||
    /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) ||
    /^[2mn][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let reservedWithdrawal = false;
  let referenceId = "";
  let supabase: ReturnType<typeof createClient> | null = null;

  try {
    const authHeader = req.headers.get("authorization") ??
      req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { amount, btcAddress, requestId } = await req.json();
    const amountCents = Number(amount);
    const amountDollars = amountCents / 100;
    const destinationAddress = normalizeBtcAddress(btcAddress);
    referenceId = req.headers.get("idempotency-key") ?? requestId ??
      crypto.randomUUID();

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return jsonResponse({ error: "Amount must be greater than zero" }, 400);
    }
    if (!isLikelyBtcAddress(destinationAddress)) {
      return jsonResponse({ error: "Enter a valid Bitcoin address" }, 400);
    }

    const providerUrl = Deno.env.get("BTC_PAYOUT_PROVIDER_URL") ?? "";
    const providerApiKey = Deno.env.get("BTC_PAYOUT_PROVIDER_API_KEY") ?? "";
    const providerName = Deno.env.get("BTC_PAYOUT_PROVIDER_NAME") ??
      "configured_btc_payout";
    if (!providerUrl || !providerApiKey) {
      return jsonResponse({
        error: "BTC payout provider is not configured",
        code: "btc_provider_not_configured",
      }, 501);
    }

    supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: authData, error: authError } = await supabase.auth.getUser(
      token,
    );
    const userId = authData?.user?.id;
    if (authError || !userId) {
      return jsonResponse(
        { error: "Invalid JWT", details: authError?.message },
        401,
      );
    }

    await assertComplianceGate(supabase, {
      userId,
      action: "withdrawal",
      amount: amountDollars,
      provider: "btc_payout",
      cryptoAsset: "BTC",
    });

    const existingTx = await supabase
      .from("transactions")
      .select("id, status, metadata")
      .eq("reference_id", referenceId)
      .eq("type", "withdrawal")
      .maybeSingle();

    if (existingTx.data?.status === "completed") {
      return jsonResponse({
        status: "sent",
        transferId: existingTx.data.metadata?.btc_transfer_id ??
          existingTx.data.metadata?.transaction_hash ?? null,
        requestId: referenceId,
      });
    }

    await supabase.rpc("upsert_crypto_transaction", {
      p_provider: "btc_payout",
      p_user_id: userId,
      p_direction: "offramp",
      p_provider_transaction_id: referenceId,
      p_status: "pending",
      p_fiat_currency: "USD",
      p_fiat_amount: amountDollars,
      p_crypto_asset: "BTC",
      p_wallet_address: destinationAddress,
      p_provider_event_id: referenceId,
      p_metadata: {
        request_id: referenceId,
        provider_name: providerName,
        destination_address: destinationAddress,
      },
    });

    const { data: reserved, error: reserveError } = await supabase.rpc(
      "reserve_wallet_withdrawal",
      {
        p_user_id: userId,
        p_amount: amountDollars,
        p_reference_id: referenceId,
        p_metadata: {
          request_id: referenceId,
          provider: providerName,
          rail: "btc_withdrawal",
          destination_address: destinationAddress,
        },
      },
    );
    if (reserveError) throw reserveError;
    if (reserved === false) {
      return jsonResponse({ status: "pending", requestId: referenceId });
    }
    reservedWithdrawal = true;

    const providerResponse = await fetch(providerUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${providerApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": referenceId,
      },
      body: JSON.stringify({
        userId,
        amountUsd: amountDollars,
        asset: "BTC",
        destinationAddress,
        referenceId,
      }),
    });

    const providerPayload = await providerResponse.json().catch(() => ({}));
    if (!providerResponse.ok) {
      throw new Error(
        providerPayload?.error || providerPayload?.message ||
          "BTC payout provider failed",
      );
    }

    const transferId = providerPayload.transferId ||
      providerPayload.id ||
      providerPayload.transactionHash ||
      `btc:${referenceId}`;
    const providerFeeUsd = Number(
      providerPayload.providerFeeUsd || providerPayload.feeUsd || 0,
    );
    const netAmountUsd = Math.max(
      amountDollars - (Number.isFinite(providerFeeUsd) ? providerFeeUsd : 0),
      0,
    );

    await supabase.rpc("finalize_wallet_withdrawal", {
      p_reference_id: referenceId,
      p_transfer_id: transferId,
      p_fee_amount: Number.isFinite(providerFeeUsd) ? providerFeeUsd : 0,
      p_net_amount: netAmountUsd,
      p_metadata: {
        provider: providerName,
        btc_transfer_id: transferId,
        btc_amount: providerPayload.btcAmount ?? null,
        destination_address: destinationAddress,
        transaction_hash: providerPayload.transactionHash ?? null,
      },
    });

    await supabase.rpc("upsert_crypto_transaction", {
      p_provider: "btc_payout",
      p_user_id: userId,
      p_direction: "offramp",
      p_provider_transaction_id: referenceId,
      p_status: providerPayload.status || "completed",
      p_fiat_currency: "USD",
      p_fiat_amount: amountDollars,
      p_crypto_asset: "BTC",
      p_crypto_amount: providerPayload.btcAmount ?? null,
      p_wallet_address: destinationAddress,
      p_transaction_hash: providerPayload.transactionHash ?? null,
      p_provider_fee: Number.isFinite(providerFeeUsd) ? providerFeeUsd : null,
      p_provider_event_id: transferId,
      p_metadata: {
        request_id: referenceId,
        provider_name: providerName,
        transfer_id: transferId,
      },
    });

    return jsonResponse({
      status: "sent",
      transferId,
      requestId: referenceId,
      btcAmount: providerPayload.btcAmount ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (reservedWithdrawal && referenceId && supabase) {
      await supabase.rpc("fail_wallet_withdrawal", {
        p_reference_id: referenceId,
        p_failure_code: "btc_payout_failed",
        p_failure_message: message,
        p_metadata: { failure_source: "btc-withdrawal" },
      });
    }
    return jsonResponse({ error: message }, 400);
  }
});
