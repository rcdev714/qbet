// @ts-nocheck: Deno edge runtime (Supabase).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";
import { recordComplianceEvent } from "../_shared/compliance.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2022-11-15",
  httpClient: Stripe.createFetchHttpClient(),
});

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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    const requestId = req.headers.get("idempotency-key") ?? crypto.randomUUID();
    const appUrl =
      Deno.env.get("EXPO_PUBLIC_APP_URL") ??
      Deno.env.get("APP_URL") ??
      "http://127.0.0.1:8081";

    const session = await stripe.identity.verificationSessions.create(
      {
        type: "document",
        client_reference_id: user.id,
        provided_details: {
          email: user.email ?? undefined,
        },
        metadata: {
          userId: user.id,
          purpose: "anymarket_live_wallet",
        },
        options: {
          document: { require_matching_selfie: true },
        },
        return_url: `${appUrl}/wallet/verify?kyc=return`,
      },
      { idempotencyKey: requestId },
    );

    const { error: rpcErr } = await supabase.rpc("upsert_provider_compliance_status", {
      p_user_id: user.id,
      p_provider: "stripe_identity",
      p_provider_session_id: session.id,
      p_status: "pending",
      p_provider_customer_id: null,
      p_provider_report_id: null,
      p_provider_event_id: null,
      p_metadata: { request_id: requestId },
    });
    if (rpcErr) throw new Error(rpcErr.message);

    await recordComplianceEvent(supabase, {
      userId: user.id,
      eventType: "kyc_session_created",
      action: "stripe_identity",
      decision: "pending",
      provider: "stripe_identity",
      providerEventId: session.id,
      metadata: { request_id: requestId },
    });

    return json({
      id: session.id,
      url: session.url,
      clientSecret: session.client_secret,
      status: session.status,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 400);
  }
});
