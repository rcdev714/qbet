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
    const { userId: requestedUserId } = await req.json();

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

    const { data: wallet } = await supabase
      .from("wallets")
      .select("stripe_account_id, global_recipient_id, payout_method_id, bank_details")
      .eq("user_id", userId)
      .single();

    let details_submitted = false;
    let payouts_enabled = false;

    if (wallet?.stripe_account_id) {
      const account = await stripe.accounts.retrieve(wallet.stripe_account_id);
      details_submitted = account.details_submitted;
      payouts_enabled = account.payouts_enabled;
    }

    const bankDetails = wallet?.bank_details && typeof wallet.bank_details === "object"
      ? wallet.bank_details
      : null;

    const payoutDraft = bankDetails
      ? {
        bankName: bankDetails.bank_name ?? null,
        swift: bankDetails.swift ?? null,
        city: bankDetails.city ?? null,
        province: bankDetails.province ?? null,
        firstName: bankDetails.first_name ?? null,
        lastName: bankDetails.last_name ?? null,
      }
      : null;

    const hasProfileDraft = Boolean(
      bankDetails?.first_name && bankDetails?.bank_name,
    );

    return new Response(
      JSON.stringify({
        details_submitted,
        payouts_enabled,
        connect: { details_submitted, payouts_enabled },
        globalPayouts: {
          hasRecipient: Boolean(wallet?.global_recipient_id),
          hasPayoutMethod: Boolean(wallet?.payout_method_id),
        },
        payoutDraft,
        hasProfileDraft,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
