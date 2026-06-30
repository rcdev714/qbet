// @ts-nocheck: Deno edge runtime (Supabase).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { createEdgeLogger } from "../_shared/edge-logger.ts";
import {
    buildNotificationEmail,
    isDigestEligibleType,
    shouldSendEmailForType,
    shouldSendPushForType,
    shouldSuppressOutcomeEmailForContract,
} from "../_shared/email/notification-email.ts";
import { sendViaResend } from "../_shared/email/resend-client.ts";
import {
    buildListUnsubscribeHeaders,
    createUnsubscribeToken,
} from "../_shared/email/unsubscribe.ts";

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

type DispatchJob = {
  queueId?: string;
  notificationId?: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  readAt?: string | null;
};

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

async function resolveUnsubscribeHeaders(params: {
  adminClient: ReturnType<typeof createClient>;
  userId: string;
  category: string | undefined;
  appUrl: string;
  secret: string;
}): Promise<Record<string, string> | undefined> {
  if (!params.category || !params.secret) return undefined;
  const { hash, url } = await createUnsubscribeToken({
    userId: params.userId,
    category: params.category as "social" | "market_results" | "group_invites",
    appUrl: params.appUrl,
    secret: params.secret,
  });
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  await params.adminClient.rpc("store_email_unsubscribe_token", {
    p_user_id: params.userId,
    p_category: params.category,
    p_token_hash: hash,
    p_expires_at: expiresAt,
  });
  return buildListUnsubscribeHeaders(url);
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
    const unsubscribeSecret = Deno.env.get("EMAIL_UNSUBSCRIBE_SECRET") ?? serviceRoleKey;

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
    const queueId = body?.queueId as string | undefined;
    const processQueue = body?.processQueue === true && isServiceRole;

    if (processQueue && !isServiceRole) {
      return json({ error: "processQueue requires service role" }, 403);
    }

    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "Anymarkt <onboarding@anymarkt.com>";
    const appUrl = Deno.env.get("EXPO_PUBLIC_APP_URL") ?? "http://localhost:8081";
    const vapidPublicKey = Deno.env.get("WEB_PUSH_PUBLIC_KEY") ?? "";
    const vapidPrivateKey = Deno.env.get("WEB_PUSH_PRIVATE_KEY") ?? "";
    const vapidSubject = Deno.env.get("WEB_PUSH_SUBJECT") ?? "mailto:support@anymarkt.com";

    const jobs: DispatchJob[] = [];

    if (processQueue) {
      const { data: queueRows } = await adminClient
        .from("notification_dispatch_queue")
        .select("id, notification_id, user_id, event_type, event_title, event_body, event_data")
        .is("processed_at", null)
        .order("created_at", { ascending: true })
        .limit(50);

      for (const row of queueRows ?? []) {
        let readAt: string | null = null;
        if (row.notification_id) {
          const { data: notif } = await adminClient
            .from("notifications")
            .select("read_at")
            .eq("id", row.notification_id)
            .maybeSingle();
          readAt = notif?.read_at ?? null;
        }
        jobs.push({
          queueId: row.id,
          notificationId: row.notification_id ?? undefined,
          userId: row.user_id,
          type: row.event_type,
          title: row.event_title,
          body: row.event_body,
          data: row.event_data,
          readAt,
        });
      }
    } else if (queueId) {
      const { data: row } = await adminClient
        .from("notification_dispatch_queue")
        .select("id, notification_id, user_id, event_type, event_title, event_body, event_data")
        .eq("id", queueId)
        .maybeSingle();
      if (row) {
        jobs.push({
          queueId: row.id,
          notificationId: row.notification_id ?? undefined,
          userId: row.user_id,
          type: row.event_type,
          title: row.event_title,
          body: row.event_body,
          data: row.event_data,
        });
      }
    } else if (notificationId) {
      const { data: notification } = await adminClient
        .from("notifications")
        .select("*")
        .eq("id", notificationId)
        .maybeSingle();
      if (notification) {
        jobs.push({
          notificationId: notification.id,
          userId: notification.user_id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          data: notification.data,
          readAt: notification.read_at,
        });
      }
    } else if (body?.marketId) {
      const { data: marketNotifications } = await adminClient
        .from("notifications")
        .select("*")
        .filter("data->>market_id", "eq", body.marketId as string);
      for (const notification of marketNotifications ?? []) {
        jobs.push({
          notificationId: notification.id,
          userId: notification.user_id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          data: notification.data,
          readAt: notification.read_at,
        });
      }
    } else {
      return json({ error: "notificationId, queueId, marketId, or processQueue required" }, 400);
    }

    const results: Record<string, unknown>[] = [];
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";

    for (const job of jobs) {
      if (!isServiceRole && job.notificationId) {
        const { data: authData } = await userClient.auth.getUser(token);
        if (authData.user?.id !== job.userId) {
          results.push({ notificationId: job.notificationId, error: "Forbidden" });
          continue;
        }
      }

      const { data: userRow } = await adminClient
        .from("users")
        .select("email, username")
        .eq("id", job.userId)
        .maybeSingle();

      const { data: prefs } = await adminClient
        .from("user_notification_preferences")
        .select("*")
        .eq("user_id", job.userId)
        .maybeSingle();

      const defaultPrefs = {
        email_enabled: true,
        email_market_results: true,
        email_social: true,
        email_group_invites: true,
        push_web_enabled: true,
        push_market_results: true,
        push_social: true,
        email_frequency: "immediate",
        email_skip_if_read: true,
      };
      const p = { ...defaultPrefs, ...(prefs ?? {}) };

      const result: Record<string, unknown> = {
        notificationId: job.notificationId,
        queueId: job.queueId,
        type: job.type,
      };

      const deliveryNotificationId = job.notificationId;
      const marketId = job.data?.market_id as string | undefined;

      const suppressForContract = await shouldSuppressOutcomeEmailForContract(
        adminClient,
        job.userId,
        marketId,
        job.type,
      );

      const skipIfRead =
        p.email_skip_if_read &&
        job.readAt &&
        Date.now() - new Date(job.readAt).getTime() < 2 * 60 * 60 * 1000;

      const digestMode =
        p.email_frequency === "daily_digest" || p.email_frequency === "weekly_digest";
      const digestEligible = isDigestEligibleType(job.type);

      if (
        resendApiKey &&
        userRow?.email &&
        shouldSendEmailForType(job.type, p) &&
        !suppressForContract
      ) {
        if (skipIfRead) {
          if (deliveryNotificationId) {
            await adminClient.rpc("record_notification_delivery", {
              p_notification_id: deliveryNotificationId,
              p_channel: "email",
              p_status: "skipped",
              p_idempotency_key: null,
              p_error: "Already read in app",
            });
          }
          result.email = "skipped:read_in_app";
        } else if (digestMode && digestEligible) {
          await adminClient.rpc("enqueue_email_digest_item", {
            p_user_id: job.userId,
            p_notification_id: deliveryNotificationId ?? null,
            p_event_type: job.type,
            p_event_title: job.title,
            p_event_body: job.body,
            p_event_data: job.data ?? {},
            p_digest_frequency: p.email_frequency,
          });
          if (deliveryNotificationId) {
            await adminClient.rpc("record_notification_delivery", {
              p_notification_id: deliveryNotificationId,
              p_channel: "email",
              p_status: "skipped",
              p_idempotency_key: `digest/${deliveryNotificationId}`,
              p_error: "Queued for digest",
            });
          }
          result.email = "queued:digest";
        } else {
          const emailId = job.notificationId ?? job.queueId ?? crypto.randomUUID();
          const emailPayload = buildNotificationEmail({
            type: job.type,
            title: job.title,
            body: job.body,
            data: job.data,
            notificationId: emailId,
            appUrl,
          });

          if (emailPayload) {
            const headers = await resolveUnsubscribeHeaders({
              adminClient,
              userId: job.userId,
              category: emailPayload.unsubscribeCategory,
              appUrl,
              secret: unsubscribeSecret,
            });

            const sendResult = await sendViaResend(resendApiKey, {
              from: fromEmail,
              to: [userRow.email],
              subject: emailPayload.subject,
              html: emailPayload.html,
              text: emailPayload.text,
              idempotencyKey: emailPayload.idempotencyKey,
              headers,
            });

            if (deliveryNotificationId) {
              await adminClient.rpc("record_notification_delivery", {
                p_notification_id: deliveryNotificationId,
                p_channel: "email",
                p_status: sendResult.ok ? "sent" : "failed",
                p_provider_id: sendResult.ok ? sendResult.id : null,
                p_idempotency_key: emailPayload.idempotencyKey,
                p_error: sendResult.ok ? null : sendResult.message,
              });
            }

            result.email = sendResult.ok ? "sent" : sendResult.message;
          } else if (deliveryNotificationId) {
            await adminClient.rpc("record_notification_delivery", {
              p_notification_id: deliveryNotificationId,
              p_channel: "email",
              p_status: "skipped",
              p_idempotency_key: null,
              p_error: suppressForContract ? "contract_receipt_sent" : "No template for type",
            });
            result.email = suppressForContract ? "skipped:contract_receipt" : "skipped";
          }
        }
      } else if (deliveryNotificationId) {
        await adminClient.rpc("record_notification_delivery", {
          p_notification_id: deliveryNotificationId,
          p_channel: "email",
          p_status: "skipped",
          p_idempotency_key: null,
          p_error: suppressForContract
            ? "contract_receipt_sent"
            : "Prefs disabled or no email",
        });
        result.email = suppressForContract ? "skipped:contract_receipt" : "skipped";
      }

      if (vapidPublicKey && vapidPrivateKey && shouldSendPushForType(job.type, p)) {
        const { data: subs } = await adminClient
          .from("web_push_subscriptions")
          .select("*")
          .eq("user_id", job.userId);

        const pushUrl = marketId
          ? `${appUrl.replace(/\/$/, "")}/market/${marketId}`
          : appUrl;

        let pushSent = 0;
        for (const sub of subs ?? []) {
          const pushResult = await sendWebPush(
            sub,
            { title: job.title, body: job.body ?? "", url: pushUrl },
            vapidPublicKey,
            vapidPrivateKey,
            vapidSubject,
          );
          if (pushResult.ok) pushSent++;
        }

        if (deliveryNotificationId) {
          await adminClient.rpc("record_notification_delivery", {
            p_notification_id: deliveryNotificationId,
            p_channel: "web_push",
            p_status: pushSent > 0 ? "sent" : "skipped",
            p_idempotency_key: `push/${deliveryNotificationId}`,
            p_error: pushSent > 0 ? null : "No active subscriptions",
          });
        }
        result.push = pushSent > 0 ? `sent:${pushSent}` : "skipped";
      }

      if (job.queueId) {
        await adminClient.rpc("mark_notification_dispatch_processed", {
          p_queue_id: job.queueId,
        });
      } else if (job.notificationId) {
        await adminClient.rpc("mark_notification_dispatch_processed", {
          p_notification_id: job.notificationId,
        });
      }

      results.push(result);
    }

    return json({ ok: true, processed: results.length, results });
  } catch (error) {
    log.error("dispatch failed", { error: String(error) });
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
