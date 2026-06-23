// @ts-nocheck: Deno edge runtime (Supabase).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { createEdgeLogger } from "../_shared/edge-logger.ts";
import {
    buildNotificationEmail,
    shouldSendEmailForType,
    shouldSendPushForType,
} from "../_shared/email/notification-email.ts";
import { sendViaResend } from "../_shared/email/resend-client.ts";

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

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url: string },
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const webpush = await import("https://esm.sh/web-push@3.6.7");
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
    );
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

serve(async (req) => {
  const log = createEdgeLogger("dispatch-notification");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const isServiceRole = serviceRoleKey.length > 0 && token === serviceRoleKey;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    let userClient = adminClient;

    if (!isServiceRole) {
      userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: authData, error: authError } = await userClient.auth.getUser(token);
      if (authError || !authData.user) {
        return json({ error: "Unauthorized" }, 401);
      }
    }
    const body = await req.json();
    const notificationId = body?.notificationId as string | undefined;
    const processQueue = body?.processQueue === true && isServiceRole;

    if (processQueue && !isServiceRole) {
      return json({ error: "processQueue requires service role" }, 403);
    }
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "AnyMarket <onboarding@camella.app>";
    const appUrl = Deno.env.get("EXPO_PUBLIC_APP_URL") ?? "http://localhost:8081";
    const vapidPublicKey = Deno.env.get("WEB_PUSH_PUBLIC_KEY") ?? "";
    const vapidPrivateKey = Deno.env.get("WEB_PUSH_PRIVATE_KEY") ?? "";
    const vapidSubject = Deno.env.get("WEB_PUSH_SUBJECT") ?? "mailto:support@camella.app";

    let notificationIds: string[] = [];

    if (processQueue) {
      const { data: queueRows } = await adminClient
        .from("notification_dispatch_queue")
        .select("notification_id")
        .is("processed_at", null)
        .order("created_at", { ascending: true })
        .limit(50);

      notificationIds = (queueRows ?? []).map((r) => r.notification_id);
    } else if (notificationId) {
      notificationIds = [notificationId];
    } else if (body?.marketId) {
      const { data: marketNotifications } = await adminClient
        .from("notifications")
        .select("id")
        .filter("data->>market_id", "eq", body.marketId as string);
      notificationIds = (marketNotifications ?? []).map((row) => row.id);
    } else {
      return json({ error: "notificationId, marketId, or processQueue required" }, 400);
    }

    const results: Record<string, unknown>[] = [];

    for (const id of notificationIds) {
      const { data: notification, error: notifError } = await adminClient
        .from("notifications")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (notifError || !notification) {
        results.push({ notificationId: id, error: "Notification not found" });
        continue;
      }

      if (!isServiceRole) {
        const { data: authData } = await userClient.auth.getUser(token);
        if (authData.user?.id !== notification.user_id) {
          results.push({ notificationId: id, error: "Forbidden" });
          continue;
        }
      }

      const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";

      const { data: userRow } = await adminClient
        .from("users")
        .select("email, username")
        .eq("id", notification.user_id)
        .maybeSingle();

      const { data: prefs } = await adminClient
        .from("user_notification_preferences")
        .select("*")
        .eq("user_id", notification.user_id)
        .maybeSingle();

      const defaultPrefs = {
        email_enabled: true,
        email_market_results: true,
        email_social: true,
        push_web_enabled: true,
        push_market_results: true,
        push_social: true,
      };
      const p = prefs ?? defaultPrefs;

      const result: Record<string, unknown> = { notificationId: id, type: notification.type };

      // Email dispatch
      if (resendApiKey && userRow?.email && shouldSendEmailForType(notification.type, p)) {
        const emailPayload = buildNotificationEmail({
          type: notification.type,
          title: notification.title,
          body: notification.body,
          data: notification.data,
          notificationId: id,
          appUrl,
        });

        if (emailPayload) {
          const sendResult = await sendViaResend(resendApiKey, {
            from: fromEmail,
            to: [userRow.email],
            subject: emailPayload.subject,
            html: emailPayload.html,
            text: emailPayload.text,
            idempotencyKey: emailPayload.idempotencyKey,
          });

          await adminClient.rpc("record_notification_delivery", {
            p_notification_id: id,
            p_channel: "email",
            p_status: sendResult.ok ? "sent" : "failed",
            p_provider_id: sendResult.ok ? sendResult.id : null,
            p_idempotency_key: emailPayload.idempotencyKey,
            p_error: sendResult.ok ? null : sendResult.message,
          });

          result.email = sendResult.ok ? "sent" : sendResult.message;
        } else {
          await adminClient.rpc("record_notification_delivery", {
            p_notification_id: id,
            p_channel: "email",
            p_status: "skipped",
            p_idempotency_key: null,
            p_error: "No template for type",
          });
          result.email = "skipped";
        }
      } else {
        await adminClient.rpc("record_notification_delivery", {
          p_notification_id: id,
          p_channel: "email",
          p_status: "skipped",
          p_idempotency_key: null,
          p_error: "Prefs disabled or no email",
        });
        result.email = "skipped";
      }

      // Web push dispatch
      if (
        vapidPublicKey &&
        vapidPrivateKey &&
        shouldSendPushForType(notification.type, p)
      ) {
        const { data: subs } = await adminClient
          .from("web_push_subscriptions")
          .select("*")
          .eq("user_id", notification.user_id);

        const marketId = notification.data?.market_id;
        const pushUrl = marketId
          ? `${appUrl.replace(/\/$/, "")}/market/${marketId}`
          : appUrl;

        let pushSent = 0;
        for (const sub of subs ?? []) {
          const pushResult = await sendWebPush(
            sub,
            {
              title: notification.title,
              body: notification.body ?? "",
              url: pushUrl,
            },
            vapidPublicKey,
            vapidPrivateKey,
            vapidSubject,
          );
          if (pushResult.ok) pushSent++;
        }

        await adminClient.rpc("record_notification_delivery", {
          p_notification_id: id,
          p_channel: "web_push",
          p_status: pushSent > 0 ? "sent" : "skipped",
          p_idempotency_key: `push/${id}`,
          p_error: pushSent > 0 ? null : "No active subscriptions",
        });
        result.push = pushSent > 0 ? `sent:${pushSent}` : "skipped";
      }

      await adminClient.rpc("mark_notification_dispatch_processed", {
        p_notification_id: id,
      });

      results.push(result);
    }

    return json({ ok: true, processed: results.length, results });
  } catch (error) {
    log.error("dispatch failed", { error: String(error) });
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
