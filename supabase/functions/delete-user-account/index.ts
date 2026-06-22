// @ts-nocheck: Deno edge runtime (Supabase).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";
import { recordComplianceEvent } from "../_shared/compliance.ts";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
    apiVersion: "2022-11-15",
    httpClient: Stripe.createFetchHttpClient(),
  })
  : null;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, idempotency-key",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function deleteAvatarObjects(supabase: any, userId: string) {
  const { data: objects, error: listError } = await supabase.storage
    .from("avatars")
    .list(userId, { limit: 100 });

  if (listError) {
    console.warn("[delete-user-account] Failed to list avatars:", listError.message);
    return;
  }

  if (!objects?.length) return;

  const paths = objects.map((item: { name: string }) => `${userId}/${item.name}`);
  const { error: removeError } = await supabase.storage.from("avatars").remove(paths);
  if (removeError) {
    console.warn("[delete-user-account] Failed to remove avatars:", removeError.message);
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user?.id) {
      return json({ error: "Invalid JWT", details: authError?.message }, 401);
    }

    const { data: eligibility, error: eligibilityError } = await supabase.rpc(
      "check_user_can_delete_account",
      { p_user_id: user.id },
    );

    if (eligibilityError) {
      return json({ error: eligibilityError.message }, 400);
    }

    if (!eligibility?.allowed) {
      return json(
        {
          error: eligibility?.message ?? "Account deletion is not allowed right now.",
          reason: eligibility?.reason ?? "blocked",
        },
        400,
      );
    }

    const { data: wallet } = await supabase
      .from("wallets")
      .select("stripe_account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    await deleteAvatarObjects(supabase, user.id);

    if (stripe && wallet?.stripe_account_id) {
      try {
        await stripe.accounts.del(wallet.stripe_account_id);
      } catch (stripeError) {
        console.warn("[delete-user-account] Stripe account cleanup failed:", stripeError);
      }
    }

    const { error: anonymizeError } = await supabase.rpc("anonymize_user_account", {
      p_user_id: user.id,
    });
    if (anonymizeError) {
      return json({ error: anonymizeError.message }, 500);
    }

    await recordComplianceEvent(supabase, {
      userId: user.id,
      eventType: "account_deleted",
      decision: "approved",
      metadata: { source: "self_service" },
    });

    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteAuthError) {
      return json({ error: deleteAuthError.message }, 500);
    }

    return json({ success: true });
  } catch (error) {
    console.error("[delete-user-account] Unexpected error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      500,
    );
  }
});
