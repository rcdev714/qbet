// @ts-nocheck: Stripe Global Payouts v2 API for programmatic payout setup
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import {
  recipientBankCapabilities,
  stripeV2Request,
} from "../_shared/stripe-global-payouts.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") ??
      req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const body = await req.json();
    const {
      firstName,
      lastName,
      dobDay,
      dobMonth,
      dobYear,
      addressLine1,
      city,
      state,
      postalCode,
      idNumber,
      idType,
      bankAccountNumber,
      swift,
      returnPath,
    } = body;

    const appUrl = Deno.env.get("EXPO_PUBLIC_APP_URL") ||
      Deno.env.get("APP_URL") || "https://anymarkt.com";
    const normalizedReturnPath =
      typeof returnPath === "string" && returnPath.startsWith("/")
        ? returnPath
        : "/wallet";
    const returnBase = `${appUrl}${normalizedReturnPath}`;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: authData, error: authError } = await supabase.auth.getUser(
      token,
    );
    const userId = authData?.user?.id;
    if (authError || !userId) {
      return jsonResponse({ error: "Invalid JWT" }, 401);
    }

    const email = authData.user?.email;
    const userName = authData.user?.user_metadata?.full_name ||
      authData.user?.user_metadata?.name || email?.split("@")[0] || "User";
    if (!email) {
      return jsonResponse({ error: "User email not found" }, 400);
    }

    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (walletError || !wallet) {
      return jsonResponse({ error: "Wallet not found" }, 404);
    }

    const payoutCountry = (wallet.country || "US").toLowerCase();
    const idempotencyKey = req.headers.get("idempotency-key") ??
      crypto.randomUUID();

    let recipientId = wallet.global_recipient_id;

    if (!recipientId) {
      const createResponse = await stripeV2Request(
        STRIPE_SECRET_KEY,
        "/v2/core/accounts",
        "POST",
        {
          contact_email: email,
          display_name: userName,
          identity: {
            country: payoutCountry,
            entity_type: "individual",
          },
          configuration: {
            recipient: {
              capabilities: {
                bank_accounts: recipientBankCapabilities(payoutCountry),
              },
            },
          },
          include: ["identity", "configuration.recipient", "requirements"],
        },
        undefined,
        `${idempotencyKey}:create-recipient`,
      );

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        console.error("[create-payout-setup] create recipient:", errorData);
        return jsonResponse({
          error: errorData.error?.message || "Failed to create recipient",
        }, 400);
      }

      const recipient = await createResponse.json();
      recipientId = recipient.id;

      await supabase
        .from("wallets")
        .update({ global_recipient_id: recipientId })
        .eq("user_id", userId);
    }

    if (firstName || lastName || addressLine1) {
      const patchBody: Record<string, unknown> = {
        include: ["identity", "configuration.recipient", "requirements"],
      };

      const identity: Record<string, unknown> = {};
      if (firstName || lastName) {
        identity.individual = {
          given_name: firstName,
          surname: lastName,
        };
      }
      if (dobDay && dobMonth && dobYear) {
        identity.date_of_birth = {
          day: Number(dobDay),
          month: Number(dobMonth),
          year: Number(dobYear),
        };
      }
      if (addressLine1) {
        identity.address = {
          line1: addressLine1,
          city: city || undefined,
          state: state || undefined,
          postal_code: postalCode || undefined,
          country: payoutCountry.toUpperCase(),
        };
      }
      if (idNumber && payoutCountry === "ec") {
        identity.individual = {
          ...(identity.individual as object || {}),
          nationalities: [{ country: "EC" }],
          id_numbers: [{ type: idType || "national_id", value: idNumber }],
        };
      }

      if (Object.keys(identity).length > 0) {
        patchBody.identity = identity;
      }

      const patchResponse = await stripeV2Request(
        STRIPE_SECRET_KEY,
        `/v2/core/accounts/${recipientId}`,
        "PATCH",
        patchBody,
        undefined,
        `${idempotencyKey}:patch-recipient`,
      );

      if (!patchResponse.ok) {
        const patchError = await patchResponse.json();
        console.error("[create-payout-setup] patch recipient:", patchError);
      }
    }

    let payoutMethodId = wallet.payout_method_id;

    if (!payoutMethodId && bankAccountNumber && swift) {
      const bankPayload: Record<string, unknown> = {
        country: payoutCountry.toUpperCase(),
        account_number: String(bankAccountNumber).trim(),
      };

      if (payoutCountry === "ec") {
        bankPayload.routing_number = String(swift).trim();
      }

      const setupResponse = await stripeV2Request(
        STRIPE_SECRET_KEY,
        "/v2/money_management/outbound_setup_intents",
        "POST",
        {
          payout_method_data: {
            type: "bank_account",
            bank_account: bankPayload,
          },
        },
        recipientId,
        `${idempotencyKey}:outbound-setup`,
      );

      if (setupResponse.ok) {
        const setupData = await setupResponse.json();
        payoutMethodId = setupData.payout_method?.id ??
          setupData.payout_method_id ?? null;

        if (payoutMethodId) {
          await supabase
            .from("wallets")
            .update({ payout_method_id: payoutMethodId })
            .eq("user_id", userId);
        }
      } else {
        const setupError = await setupResponse.json();
        console.error("[create-payout-setup] outbound setup:", setupError);
      }
    }

    if (!payoutMethodId) {
      const pmResponse = await stripeV2Request(
        STRIPE_SECRET_KEY,
        "/v2/money_management/payout_methods",
        "GET",
        undefined,
        recipientId,
      );

      if (pmResponse.ok) {
        const pmData = await pmResponse.json();
        const methods = pmData.data || [];
        if (methods.length > 0) {
          payoutMethodId = methods[0].id;
          await supabase
            .from("wallets")
            .update({ payout_method_id: payoutMethodId })
            .eq("user_id", userId);
        }
      }
    }

    if (payoutMethodId) {
      return jsonResponse({
        success: true,
        payoutMethodId,
        recipientId,
        status: "ready",
      });
    }

    const linkResponse = await stripeV2Request(
      STRIPE_SECRET_KEY,
      "/v2/core/account_links",
      "POST",
      {
        account: recipientId,
        use_case: {
          type: "account_onboarding",
          account_onboarding: {
            configurations: ["recipient"],
            return_url: `${returnBase}?onboarding=complete`,
            refresh_url: `${returnBase}?onboarding=refresh`,
          },
        },
      },
      undefined,
      `${idempotencyKey}:onboarding-link`,
    );

    if (linkResponse.ok) {
      const accountLink = await linkResponse.json();
      return jsonResponse({
        success: true,
        needsOnboarding: accountLink.url,
        recipientId,
        status: "needs_hosted_onboarding",
      });
    }

    const linkError = await linkResponse.json();
    return jsonResponse({
      success: false,
      error: linkError.error?.message || "Payout setup incomplete",
      recipientId,
    }, 400);
  } catch (error) {
    console.error("[create-payout-setup]", error);
    return jsonResponse({ error: error.message || "Internal error" }, 500);
  }
});
