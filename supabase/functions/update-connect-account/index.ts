// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
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
        const {
            userId,
            firstName,
            lastName,
            dobDay,
            dobMonth,
            dobYear,
            addressLine1,
            city,
            state,
            postalCode,
            ssnLast4,
            externalAccountToken
        } = await req.json();

        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("EXPO_PUBLIC_SUPABASE_URL") ?? "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Get Wallet to find Stripe Account ID
        const { data: wallet, error: walletError } = await supabase
            .from("wallets")
            .select("stripe_account_id")
            .eq("user_id", userId)
            .maybeSingle();

        if (walletError || !wallet?.stripe_account_id) {
            throw new Error("Wallet or Stripe Account not found for user");
        }

        const accountId = wallet.stripe_account_id;

        console.log(`Updating account ${accountId} with KYC data...`);

        // 2. Update Stripe Account with PII (KYC)
        await stripe.accounts.update(accountId, {
            individual: {
                first_name: firstName,
                last_name: lastName,
                dob: {
                    day: dobDay,
                    month: dobMonth,
                    year: dobYear,
                },
                address: {
                    line1: addressLine1,
                    city: city,
                    state: state,
                    postal_code: postalCode,
                    country: "US",
                },
                ssn_last_4: ssnLast4,
            },
            business_profile: {
                mcc: "5734", // Computer Software Stores (General digital goods) - Adjust as needed
                url: "https://myapp.com", // Placeholder
            },
        });

        // 3. Attach External Account (Debit Card for Payouts) if token provided
        if (externalAccountToken) {
            console.log(`Attaching external account to ${accountId}...`);
            await stripe.accounts.createExternalAccount(accountId, {
                external_account: externalAccountToken,
            });
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error: any) {
        console.error("Error updating connect account:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
