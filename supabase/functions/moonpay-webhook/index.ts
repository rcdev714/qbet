// @ts-nocheck: MoonPay webhook → crypto_transactions + optional wallet credit (onramp).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { normalizeProviderStatus } from "../_shared/compliance.ts";

const encoder = new TextEncoder();

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

async function verifyMoonPaySignature(
  rawBody: string,
  signatureHeader: string | null,
) {
  const secret = Deno.env.get("MOONPAY_WEBHOOK_SECRET") ?? "";
  if (!secret) return false;
  if (!signatureHeader) return false;

  const parts = signatureHeader.split(",").map((p) => p.trim());
  let timestamp = "";
  let signature = "";
  for (const part of parts) {
    if (part.startsWith("t=")) timestamp = part.slice(2);
    if (part.startsWith("s=")) signature = part.slice(2);
    if (part.startsWith("v1=")) signature = part.slice(3);
  }
  if (!timestamp || !signature) return false;

  const timestampMs = Number(timestamp) * 1000;
  if (
    !Number.isFinite(timestampMs) ||
    Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000
  ) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${rawBody}`),
  );
  const expected = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return timingSafeEqual(expected, signature);
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function isCompletedStatus(s: string) {
  const x = (s || "").toLowerCase();
  return ["completed", "complete", "succeeded", "success", "approved"].includes(
    x,
  );
}

function safeNumber(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

serve(async (req: Request) => {
  const rawBody = await req.text();
  const signature = req.headers.get("Moonpay-Signature-V2") ??
    req.headers.get("moonpay-signature-v2");

  if (!(await verifyMoonPaySignature(rawBody, signature))) {
    return json({ error: "Invalid MoonPay signature" }, 400);
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const eventType = String(
    event.type ?? event.eventType ?? "moonpay.transaction.updated",
  );
  const payload = (event.data ?? event) as Record<string, unknown>;
  const tx = (payload.transaction as Record<string, unknown> | undefined) ??
    payload;

  const providerTransactionId = String(
    tx.id ?? tx.transactionId ?? payload.id ?? "",
  ).trim();
  const externalCustomerId = String(
    tx.externalCustomerId ??
      (payload.externalCustomerId as string) ??
      (payload.customer as Record<string, unknown> | undefined)
        ?.externalCustomerId ??
      "",
  ).trim();

  const rawStatus = String(tx.status ?? payload.status ?? "pending");

  if (!providerTransactionId || !externalCustomerId) {
    return json({
      error: "MoonPay webhook missing transaction or customer reference",
    }, 400);
  }

  const direction =
    eventType.includes("sell") || String(tx.type ?? payload.type) === "sell"
      ? "offramp"
      : "onramp";
  const fiatCurrency = direction === "offramp"
    ? ((tx.quoteCurrency as Record<string, unknown> | undefined)?.code ??
      tx.fiatCurrency ?? payload.fiatCurrency ?? "USD")
    : ((tx.baseCurrency as Record<string, unknown> | undefined)?.code ??
      tx.fiatCurrency ?? payload.fiatCurrency ?? "USD");
  const fiatAmount = direction === "offramp"
    ? safeNumber(tx.quoteCurrencyAmount ?? tx.fiatAmount)
    : safeNumber(tx.baseCurrencyAmount ?? tx.fiatAmount);
  const cryptoAsset = direction === "offramp"
    ? ((tx.baseCurrency as Record<string, unknown> | undefined)?.code ??
      tx.cryptoCurrency ?? tx.asset)
    : ((tx.currency as Record<string, unknown> | undefined)?.code ??
      tx.cryptoCurrency ?? tx.asset);
  const cryptoAmount = direction === "offramp"
    ? safeNumber(tx.baseCurrencyAmount ?? tx.cryptoAmount)
    : safeNumber(tx.quoteCurrencyAmount ?? tx.cryptoAmount);
  const providerFee = (safeNumber(tx.feeAmount) || 0) +
    (safeNumber(tx.networkFeeAmount) || 0);
  const providerEventId = String(
    event.id ?? `${providerTransactionId}:${eventType}:${rawStatus}`,
  );

  const { error: txError } = await supabase.rpc("upsert_crypto_transaction", {
    p_user_id: externalCustomerId,
    p_direction: direction,
    p_provider_transaction_id: providerTransactionId,
    p_status: rawStatus,
    p_fiat_currency: String(fiatCurrency).toUpperCase(),
    p_fiat_amount: fiatAmount,
    p_crypto_asset: cryptoAsset ? String(cryptoAsset).toUpperCase() : null,
    p_crypto_amount: cryptoAmount,
    p_network: String(tx.network ?? tx.blockchain ?? "") || null,
    p_wallet_address: String(
      tx.walletAddress ??
        (tx.wallet as Record<string, unknown> | undefined)?.address ?? "",
    ) || null,
    p_refund_wallet_address: String(tx.refundWalletAddress ?? "") || null,
    p_transaction_hash: String(
      tx.cryptoTransactionId ?? tx.transactionHash ?? "",
    ) || null,
    p_provider_fee: providerFee > 0 ? providerFee : null,
    p_provider_event_id: providerEventId,
    p_metadata: {
      event_type: eventType,
      raw_status: rawStatus,
      external_transaction_id: tx.externalTransactionId ?? null,
    },
    p_provider: "moonpay",
  });
  if (txError) return json({ error: txError.message }, 400);

  if (direction === "onramp" && isCompletedStatus(rawStatus)) {
    const { error: creditErr } = await supabase.rpc(
      "apply_crypto_onramp_credit",
      {
        p_provider: "moonpay",
        p_provider_transaction_id: providerTransactionId,
        p_provider_event_id: providerEventId,
        p_metadata: { event_type: eventType },
      },
    );
    if (creditErr) return json({ error: creditErr.message }, 400);
  }

  const explicitKycStatus = tx.kycStatus ||
    (tx.customer as Record<string, unknown> | undefined)?.kycStatus ||
    (tx.customer as Record<string, unknown> | undefined)?.verificationStatus ||
    tx.verificationStatus;
  if (explicitKycStatus) {
    const normalizedKyc = normalizeProviderStatus(
      "moonpay",
      String(explicitKycStatus),
    );
    const { error: kycError } = await supabase.rpc(
      "upsert_provider_compliance_status",
      {
        p_user_id: externalCustomerId,
        p_provider: "moonpay",
        p_provider_session_id: providerTransactionId,
        p_status: normalizedKyc,
        p_provider_customer_id: String(tx.customerId ?? "") || null,
        p_provider_report_id: null,
        p_provider_event_id: providerEventId,
        p_metadata: {
          event_type: eventType,
          raw_status: rawStatus,
          explicit_kyc_status: explicitKycStatus,
        },
      },
    );
    if (kycError) return json({ error: kycError.message }, 400);
  }

  return json({ received: true });
});
