// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2022-11-15",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("EXPO_PUBLIC_SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get stripe_account_id
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("stripe_account_id")
      .eq("user_id", userId)
      .select("stripe_account_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (walletError || !wallet?.stripe_account_id) {
      console.error("Wallet error or missing stripe_account_id:", walletError, wallet);
      throw new Error("Stripe account not found for user.");
    }

    // 2. Create Account Link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: wallet.stripe_account_id,
      refresh_url: `${supabaseUrl}/functions/v1/onboarding-callback?status=refresh`,
      return_url: `${supabaseUrl}/functions/v1/onboarding-callback?status=return`,
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

