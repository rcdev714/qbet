// @ts-nocheck: Deno edge runtime (Supabase).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Resend } from "https://esm.sh/resend@6.14.0";
import { createEdgeLogger } from "../_shared/edge-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  const log = createEdgeLogger("resend-webhook");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET") ?? "";
    const payload = await req.text();

    let event: { type?: string; data?: Record<string, unknown> };
    if (webhookSecret) {
      const resend = new Resend(Deno.env.get("RESEND_API_KEY") ?? "");
      event = resend.webhooks.verify({
        payload,
        headers: {
          "svix-id": req.headers.get("svix-id") ?? "",
          "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
          "svix-signature": req.headers.get("svix-signature") ?? "",
        },
        secret: webhookSecret,
      }) as { type?: string; data?: Record<string, unknown> };
    } else {
      event = JSON.parse(payload);
      log.warn("webhook secret not configured — accepting unsigned payload");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const eventType = event.type ?? "";
    const emailTo = (event.data?.to as string[] | undefined)?.[0] ??
      (event.data?.email as string | undefined);

    if ((eventType === "email.bounced" || eventType === "email.complained") && emailTo) {
      const { data: userRow } = await adminClient
        .from("users")
        .select("id")
        .eq("email", emailTo)
        .maybeSingle();

      if (userRow?.id) {
        await adminClient
          .from("user_notification_preferences")
          .update({ email_enabled: false, updated_at: new Date().toISOString() })
          .eq("user_id", userRow.id);

        log.info("disabled email for user due to bounce/complaint", {
          userId: userRow.id,
          eventType,
        });
      }
    }

    return json({ ok: true, type: eventType });
  } catch (error) {
    log.error("webhook failed", { error: String(error) });
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 400);
  }
});
