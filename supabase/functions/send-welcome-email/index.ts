// @ts-nocheck: Deno edge runtime (Supabase).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { createEdgeLogger } from "../_shared/edge-logger.ts";
import { sendViaResend } from "../_shared/email/resend-client.ts";
import { buildWelcomeEmail } from "../_shared/email/templates/welcome.ts";

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

serve(async (req) => {
  const log = createEdgeLogger("send-welcome-email");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const isServiceRole = serviceRoleKey.length > 0 && token === serviceRoleKey;

    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "AnyMarket <onboarding@camella.app>";
    const appUrl = Deno.env.get("EXPO_PUBLIC_APP_URL") ?? "http://localhost:8081";

    if (!resendApiKey) {
      return json({ error: "RESEND_API_KEY is not configured" }, 500);
    }

    const body = await req.json();
    const userId = body?.userId as string | undefined;

    if (!userId) {
      return json({ error: "userId is required" }, 400);
    }

    if (!isServiceRole) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: authData, error: authError } = await userClient.auth.getUser(token);
      if (authError || authData.user?.id !== userId) {
        return json({ error: "Forbidden" }, 403);
      }
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: user } = await adminClient
      .from("users")
      .select("email, username")
      .eq("id", userId)
      .maybeSingle();

    if (!user?.email) {
      return json({ error: "User email not found" }, 404);
    }

    const emailPayload = buildWelcomeEmail({
      username: user.username,
      appUrl,
    });

    const sendResult = await sendViaResend(resendApiKey, {
      from: fromEmail,
      to: [user.email],
      subject: emailPayload.subject,
      html: emailPayload.html,
      text: emailPayload.text,
      idempotencyKey: `${emailPayload.idempotencyKey}/${userId}`,
    });

    if (!sendResult.ok) {
      log.error("Resend failed", { message: sendResult.message });
      return json({ error: sendResult.message }, 502);
    }

    return json({ ok: true, emailId: sendResult.id });
  } catch (error) {
    log.error("unexpected error", { error: String(error) });
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
