// @ts-nocheck: This is a workaround to allow the use of the Stripe API in the Deno runtime.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";
import {
  buildAllowedOrigins,
  resolveAllowedUrl,
} from "../_shared/payment-hardening.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2022-11-15",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function allowedOrigins(supabaseUrl: string) {
  return buildAllowedOrigins([
    Deno.env.get("EXPO_PUBLIC_APP_URL"),
    Deno.env.get("APP_URL"),
    supabaseUrl,
    "https://anymarkt.com",
  ]);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId: requestedUserId, returnUrl, refreshUrl } = await req.json();

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

    // 1. Get stripe_account_id
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("stripe_account_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (walletError || !wallet?.stripe_account_id) {
      console.error(
        "Wallet error or missing stripe_account_id:",
        walletError,
        wallet,
      );
      throw new Error("Stripe account not found for user.");
    }

    // 2. Create Account Link for onboarding
    const defaultRefreshUrl =
      `${supabaseUrl}/functions/v1/onboarding-callback?status=refresh`;
    const defaultReturnUrl =
      `${supabaseUrl}/functions/v1/onboarding-callback?status=return`;
    const origins = allowedOrigins(supabaseUrl);
    const accountLink = await stripe.accountLinks.create({
      account: wallet.stripe_account_id,
      refresh_url: resolveAllowedUrl(
        refreshUrl,
        defaultRefreshUrl,
        origins,
        "Account link return URL is not allowed",
      ),
      return_url: resolveAllowedUrl(
        returnUrl,
        defaultReturnUrl,
        origins,
        "Account link return URL is not allowed",
      ),
      type: "account_onboarding",
    });

    return new Response(JSON.stringify({ url: accountLink.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in create-account-link:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
