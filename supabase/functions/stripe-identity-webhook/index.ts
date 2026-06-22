// @ts-nocheck: Deno edge runtime (Supabase).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";
import { normalizeProviderStatus } from "../_shared/compliance.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2022-11-15",
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const webhookSecret =
  Deno.env.get("STRIPE_IDENTITY_WEBHOOK_SECRET") ??
  Deno.env.get("STRIPE_WEBHOOK_SECRET") ??
  "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

serve(async (req: Request) => {
  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();

  if (!signature) return json({ error: "Missing Stripe-Signature header" }, 400);
  if (!webhookSecret) return json({ error: "Webhook secret not configured" }, 500);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    return json({ error: msg }, 400);
  }

  if (!event.type.startsWith("identity.verification_session.")) {
    return json({ received: true, ignored: true });
  }

  const session = event.data.object as Stripe.Identity.VerificationSession;
  const userId = session.metadata?.userId || session.client_reference_id;
  if (!userId) return json({ error: "Verification session missing user reference" }, 400);

  const normalized = normalizeProviderStatus("stripe_identity", session.status);
  const reportId =
    typeof session.last_verification_report === "string"
      ? session.last_verification_report
      : session.last_verification_report?.id;

  const { error } = await supabase.rpc("upsert_provider_compliance_status", {
    p_user_id: userId,
    p_provider: "stripe_identity",
    p_provider_session_id: session.id,
    p_status: normalized,
    p_provider_customer_id: null,
    p_provider_report_id: reportId ?? null,
    p_provider_event_id: event.id,
    p_metadata: {
      stripe_status: session.status,
      event_type: event.type,
      livemode: event.livemode,
    },
  });

  if (error) return json({ error: error.message }, 400);
  return json({ received: true, status: normalized });
});
