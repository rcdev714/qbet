// @ts-nocheck: MoonPay hosted widget URL helper.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import {
    assertComplianceGate,
    recordComplianceEvent,
} from "../_shared/compliance.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const encoder = new TextEncoder();

function normalizeCurrency(value: unknown, fallback: string) {
  return String(value || fallback).trim().toLowerCase();
}

function appUrl() {
  return Deno.env.get("EXPO_PUBLIC_APP_URL") ||
    Deno.env.get("APP_URL") ||
    "https://anymarket.expo.app";
}

async function signMoonPayUrl(url: URL) {
  const secretKey = Deno.env.get("MOONPAY_SECRET_KEY") ||
    Deno.env.get("MOONPAY_API_SECRET") ||
    Deno.env.get("MOONPAY_PRIVATE_KEY") ||
    "";

  if (!secretKey) {
    throw new Error("MoonPay secret key is required to sign widget URLs.");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(url.search),
  );
  const binary = String.fromCharCode(...new Uint8Array(digest));
  return btoa(binary);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") ??
      req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getUser(
      token,
    );
    const user = authData?.user;
    if (authError || !user?.id) {
      return json({ error: "Invalid JWT", details: authError?.message }, 401);
    }

    const {
      direction = "onramp",
      fiatAmount,
      fiatCurrency = "usd",
      cryptoCurrency = "btc",
      network,
      walletAddress,
      refundWalletAddress,
    } = await req.json();

    const normalizedDirection = direction === "offramp" ? "offramp" : "onramp";
    const normalizedFiat = normalizeCurrency(fiatCurrency, "usd");
    const normalizedCrypto = normalizeCurrency(cryptoCurrency, "btc");
    const externalTransactionId = crypto.randomUUID();
    const action = normalizedDirection === "offramp"
      ? "moonpay_offramp"
      : "moonpay_onramp";
    await assertComplianceGate(supabase, {
      userId: user.id,
      action,
      amount: fiatAmount != null ? Number(fiatAmount) : null,
      provider: "moonpay",
      cryptoAsset: normalizedCrypto.toUpperCase(),
      cryptoNetwork: network ?? null,
    });

    const apiKey = Deno.env.get("MOONPAY_PUBLIC_KEY") ??
      Deno.env.get("MOONPAY_API_KEY") ?? "";
    if (!apiKey) {
      throw new Error("MoonPay public API key is not configured.");
    }

    const baseUrl = normalizedDirection === "offramp"
      ? (Deno.env.get("MOONPAY_SELL_WIDGET_URL") ?? "https://sell.moonpay.com")
      : (Deno.env.get("MOONPAY_BUY_WIDGET_URL") ?? "https://buy.moonpay.com");
    const url = new URL(baseUrl);
    const redirectUrl =
      `${appUrl()}/wallet?moonpay=return&externalTransactionId=${externalTransactionId}`;
    const treasuryWalletAddress = walletAddress ||
      Deno.env.get("MOONPAY_BTC_WALLET_ADDRESS") ||
      Deno.env.get("BTC_TREASURY_WALLET_ADDRESS") ||
      "";

    if (normalizedDirection === "onramp" && !treasuryWalletAddress) {
      throw new Error(
        "BTC treasury wallet address is required for MoonPay on-ramp wallet crediting.",
      );
    }

    const params = new URLSearchParams({
      apiKey,
      externalCustomerId: user.id,
      externalTransactionId,
      email: user.email ?? "",
      redirectURL: redirectUrl,
    });

    if (normalizedDirection === "offramp") {
      params.set("baseCurrencyCode", normalizedCrypto);
      params.set("quoteCurrencyCode", normalizedFiat);
      if (fiatAmount != null && fiatAmount !== "") {
        params.set("quoteCurrencyAmount", String(fiatAmount));
      }
      if (refundWalletAddress) {
        params.set("refundWalletAddress", refundWalletAddress);
      }
    } else {
      params.set("baseCurrencyCode", normalizedFiat);
      params.set("currencyCode", normalizedCrypto);
      params.set("walletAddress", treasuryWalletAddress);
      if (fiatAmount != null && fiatAmount !== "") {
        params.set("baseCurrencyAmount", String(fiatAmount));
      }
      params.set("lockAmount", "true");
    }

    for (const [key, value] of params.entries()) {
      url.searchParams.set(key, value);
    }

    const signature = await signMoonPayUrl(url);
    url.searchParams.set("signature", signature);

    await recordComplianceEvent(supabase, {
      userId: user.id,
      eventType: "moonpay_session_created",
      action,
      decision: "pending",
      provider: "moonpay",
      metadata: {
        direction: normalizedDirection,
        externalTransactionId,
        fiatAmount,
        fiatCurrency: normalizedFiat,
        cryptoCurrency: normalizedCrypto,
        network,
        hasWalletAddress: Boolean(treasuryWalletAddress),
      },
    });

    return json({
      url: url.toString(),
      direction: normalizedDirection,
      externalTransactionId,
      signed: true,
    });
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      400,
    );
  }
});
