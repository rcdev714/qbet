// @ts-nocheck: This is a workaround to allow the use of the Stripe API in the Deno runtime.
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
            userId: requestedUserId,
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
            idNumber,
            idType,
            country,
            externalAccountToken
        } = await req.json();

        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const authHeader = req.headers.get("authorization") ??
            req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 401,
            });
        }
        const token = authHeader.replace("Bearer ", "");
        const { data: authData, error: authError } = await supabase.auth.getUser(token);
        const userId = authData?.user?.id;
        if (authError || !userId) {
            return new Response(JSON.stringify({ error: "Invalid JWT", details: authError?.message }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 401,
            });
        }
        if (requestedUserId && requestedUserId !== userId) {
            return new Response(JSON.stringify({ error: "User mismatch" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 403,
            });
        }

        const { data: wallet, error: walletError } = await supabase
            .from("wallets")
            .select("stripe_account_id, country")
            .eq("user_id", userId)
            .maybeSingle();

        if (walletError || !wallet?.stripe_account_id) {
            throw new Error("Wallet or Stripe Account not found for user");
        }

        const accountId = wallet.stripe_account_id;
        const addressCountry = (country || wallet.country || "US").toUpperCase();
        const isEcuador = addressCountry === "EC";
        const resolvedSsn = ssnLast4 ?? (idType === "ssn" ? idNumber : undefined);

        console.log(`Updating account ${accountId} with KYC data...`);

        const individual: Record<string, unknown> = {
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
                country: addressCountry,
            },
        };

        if (isEcuador && idNumber) {
            individual.id_number = idNumber;
        } else if (resolvedSsn) {
            individual.ssn_last_4 = resolvedSsn;
        }

        await stripe.accounts.update(accountId, {
            individual,
            business_profile: {
                mcc: "7999",
                url: "https://anymarkt.com",
            },
        });

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
