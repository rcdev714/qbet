// @ts-nocheck: Deno edge runtime (Supabase).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { createEdgeLogger } from "../_shared/edge-logger.ts";
import { buildEmailLayout, buildPlainTextLayout } from "../_shared/email/layout.ts";
import { sendViaResend } from "../_shared/email/resend-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function buildDigestEmail(params: {
  items: Array<{ type: string; title: string; body: string | null }>;
  frequency: string;
  appUrl: string;
}) {
  const label = params.frequency === "weekly_digest" ? "Weekly" : "Daily";
  const subject = `${label} Anymarkt activity digest`;

  const lines = params.items.map((item) => `<li><strong>${item.title}</strong>${item.body ? ` — ${item.body}` : ""}</li>`).join("");

  const bodyHtml = `<p>Here's what you missed on Anymarkt:</p><ul>${lines}</ul>`;

  const html = buildEmailLayout({
    title: subject,
    bodyHtml,
    ctaLabel: "Open Anymarkt",
    ctaUrl: params.appUrl,
    appUrl: params.appUrl,
  });

  const text = buildPlainTextLayout({
    body: `${subject}\n\n${params.items.map((i) => i.title).join("\n")}`,
    ctaUrl: params.appUrl,
    appUrl: params.appUrl,
  });

  return { subject, html, text };
}

serve(async (req) => {
  const log = createEdgeLogger("process-email-digest");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!authHeader || authHeader.replace(/^Bearer\s+/i, "") !== serviceRoleKey) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "Anymarkt <onboarding@anymarkt.com>";
    const appUrl = Deno.env.get("EXPO_PUBLIC_APP_URL") ?? "http://localhost:8081";
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const forceFrequency = body?.frequency as string | undefined;
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcDay = now.getUTCDay();

    const { data: pendingRows, error } = await adminClient
      .from("email_digest_queue")
      .select("*")
      .is("processed_at", null)
      .order("created_at", { ascending: true })
      .limit(500);

    if (error) {
      return json({ error: error.message }, 500);
    }

    const byUser = new Map<string, typeof pendingRows>();
    for (const row of pendingRows ?? []) {
      const { data: prefs } = await adminClient
        .from("user_notification_preferences")
        .select("email_frequency, email_digest_hour_utc, email_enabled")
        .eq("user_id", row.user_id)
        .maybeSingle();

      if (!prefs?.email_enabled) continue;

      const frequency = forceFrequency ?? prefs.email_frequency ?? "immediate";
      if (frequency === "immediate") continue;
      if (row.digest_frequency !== frequency) continue;

      if (!forceFrequency) {
        if (utcHour !== Number(prefs.email_digest_hour_utc ?? 14)) continue;
        if (frequency === "weekly_digest" && utcDay !== 1) continue;
      }

      const list = byUser.get(row.user_id) ?? [];
      list.push(row);
      byUser.set(row.user_id, list);
    }

    let sent = 0;
    let users = 0;

    for (const [userId, items] of byUser.entries()) {
      if (!items?.length) continue;

      const { data: userRow } = await adminClient
        .from("users")
        .select("email")
        .eq("id", userId)
        .maybeSingle();

      if (!userRow?.email || !resendApiKey) continue;

      const frequency = items[0].digest_frequency;
      const digestBatchId = crypto.randomUUID();
      const emailPayload = buildDigestEmail({
        items: items.map((i) => ({
          type: i.event_type,
          title: i.event_title,
          body: i.event_body,
        })),
        frequency,
        appUrl,
      });

      const sendResult = await sendViaResend(resendApiKey, {
        from: fromEmail,
        to: [userRow.email],
        subject: emailPayload.subject,
        html: emailPayload.html,
        text: emailPayload.text,
        idempotencyKey: `digest/${userId}/${digestBatchId}`,
      });

      if (sendResult.ok) {
        sent += 1;
        users += 1;
        const ids = items.map((i) => i.id);
        await adminClient
          .from("email_digest_queue")
          .update({ processed_at: new Date().toISOString() })
          .in("id", ids);

        for (const item of items) {
          if (item.notification_id) {
            await adminClient.rpc("record_notification_delivery", {
              p_notification_id: item.notification_id,
              p_channel: "email",
              p_status: "sent",
              p_provider_id: sendResult.id,
              p_idempotency_key: `digest/${digestBatchId}/${item.notification_id}`,
              p_error: null,
            });
          }
        }
      } else {
        log.error("digest send failed", { userId, message: sendResult.message });
      }
    }

    log.info("digest complete", { sent, users });
    return json({ ok: true, sent, users });
  } catch (error) {
    log.error("digest error", { error: String(error) });
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
