// @ts-nocheck
import { serve } from "std/http/server.ts";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
    apiVersion: "2022-11-15",
    httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { userId, amount } = await req.json(); // amount in cents

        if (!userId || !amount) {
            throw new Error("Missing userId or amount");
        }

        // Initialize Supabase Admin Client
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("EXPO_PUBLIC_SUPABASE_URL") ?? "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Get user's wallet to check balance and get stripe_account_id
        // We also fetch email from users table via join if possible, or separate query.
        // Let's do a join to be safe, assuming 'wallets' relates to 'users'.
        const { data: wallet, error: walletError } = await supabase
            .from("wallets")
            .select("*, users:user_id(email)")
            .eq("user_id", userId)
            .single();

        if (walletError || !wallet) {
            throw new Error("Wallet not found");
        }

        const { email } = wallet.users || {};
        if (!email) {
            throw new Error("User email not found");
        }

        // Check Balance
        const amountInDollars = Number(amount) / 100;
        if (Number(wallet.balance) < amountInDollars) {
            throw new Error(`Insufficient balance. Available: $${wallet.balance}, Requested: $${amountInDollars}`);
        }

        // 2. Check if user has a Connected Account
        if (!wallet.stripe_account_id) {
            console.log(`[Stripe Withdrawal] Creating Express account for ${email}`);

            // Create Express Account
            const account = await stripe.accounts.create({
                type: "express",
                country: "EC", // Ecuador
                email: email,
                capabilities: {
                    transfers: { requested: true },
                },
                tos_acceptance: {
                    service_agreement: "recipient",
                },
                metadata: {
                    userId: userId,
                },
            });

            // Update Wallet with new Account ID
            const { error: updateError } = await supabase
                .from("wallets")
                .update({ stripe_account_id: account.id })
                .eq("user_id", userId);

            if (updateError) {
                console.error("Failed to update wallet with stripe_account_id:", updateError);
                throw new Error("Failed to link Stripe account");
            }

            // Create Account Link for Onboarding
            const accountLink = await stripe.accountLinks.create({
                account: account.id,
                refresh_url: "myapp://wallet", // Deep link to return to app
                return_url: "myapp://wallet",
                type: "account_onboarding",
            });

            return new Response(JSON.stringify({ needsOnboarding: accountLink.url }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // 3. If Account exists, check if details_submitted (optional optimization, but good practice)
        // For now, we assume if ID exists, they might be ready or need to continue.
        // Stripe transfer will fail if not ready, which is fine to catch.
        // However, if we want to be robust, we could check `stripe.accounts.retrieve` here.
        // Let's proceed to transfer and handle error.

        console.log(`[Stripe Withdrawal] Initiating transfer to ${wallet.stripe_account_id}`);

        // Fee Calculation (Database Driven)
        // Fetch fee percentage from app_settings
        let feePercentage = 0.05; // Default fallback
        const { data: settingsData, error: settingsError } = await supabase
            .from("app_settings")
            .select("value")
            .eq("key", "withdrawal_fee_percent")
            .single();

        if (!settingsError && settingsData?.value) {
            feePercentage = parseFloat(settingsData.value);
        }

        const feeAmount = Math.round(amount * feePercentage); // Amount is already in cents
        const netTransferAmount = amount - feeAmount;

        const transfer = await stripe.transfers.create({
            amount: netTransferAmount, // Transfer net amount
            currency: "usd",
            destination: wallet.stripe_account_id,
            description: "Wallet withdrawal",
            metadata: {
                userId: userId,
                type: "withdrawal",
                originalAmount: amount,
                feeAmount: feeAmount,
                feePercentage: `${(feePercentage * 100).toFixed(2)}%`
            }
        });

        // 4. Update Balance in DB
        const newBalance = Number(wallet.balance) - amountInDollars;
        const { error: balanceError } = await supabase
            .from("wallets")
            .update({ balance: newBalance })
            .eq("user_id", userId);

        if (balanceError) {
            console.error("Critical: Failed to update balance after transfer!", balanceError);
            // In prod, you'd want to reconcile this.
        }

        // 5. Log Transaction
        await supabase.from("transactions").insert({
            user_id: userId,
            type: "withdrawal",
            amount: amountInDollars,
            status: "completed",
            reference_id: transfer.id,
            fee_amount: feeAmount / 100,
            net_amount: netTransferAmount / 100,
            metadata: {
                stripe_transfer_id: transfer.id,
                destination: wallet.stripe_account_id,
                fee_percentage: `${(feePercentage * 100).toFixed(2)}%`
            }
        });

        return new Response(JSON.stringify({ status: "sent", transferId: transfer.id }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error) {
        console.error("Error in stripe-withdrawal:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400, // Bad Request
        });
    }
});
