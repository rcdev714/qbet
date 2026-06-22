// @ts-nocheck: This is a workaround to allow the use of the Stripe API in the Deno runtime.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";

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
    const { userId: requestedUserId, email } = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const authHeader = req.headers.get("authorization") ??
      req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    // 1. Check if user already has a connected account
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("stripe_account_id, country")
      .eq("user_id", userId)
      .maybeSingle();

    if (walletError) throw walletError;

    let connectCountry = (wallet?.country || "").toUpperCase();
    if (!connectCountry) {
      const { data: userRow } = await supabase
        .from("users")
        .select("country_of_residence")
        .eq("id", userId)
        .maybeSingle();
      connectCountry = (userRow?.country_of_residence || "US").toUpperCase();
    }

    if (wallet?.stripe_account_id) {
      return new Response(JSON.stringify({ accountId: wallet.stripe_account_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Create Connect Express Account
    const account = await stripe.accounts.create({
      type: "express",
      country: connectCountry,
      email: resolvedEmail,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        userId: userId,
      },
    });

    // 3. Create or Update wallet with account ID
    if (!wallet) {
      // Create new wallet with the connected account
      const { error: insertError } = await supabase
        .from("wallets")
        .insert({
          user_id: userId,
          stripe_account_id: account.id,
          balance: 0,
          is_virtual: true,
          country: connectCountry,
        });

      if (insertError) throw insertError;
    } else {
      // Update existing wallet
      const { error: updateError } = await supabase
        .from("wallets")
        .update({ stripe_account_id: account.id, country: connectCountry })
        .eq("user_id", userId);

      if (updateError) throw updateError;
    }

    return new Response(JSON.stringify({ accountId: account.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in create-connect-account:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

