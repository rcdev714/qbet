// @ts-nocheck: Deno edge runtime (Supabase).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import {
    buildApprovalEmailHtml,
    buildApprovalIdempotencyKey,
    buildWelcomeUrl,
} from "../_shared/beta-approval-email.ts";

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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "Anymarkt <onboarding@anymarkt.com>";
    const appUrl = Deno.env.get("EXPO_PUBLIC_APP_URL") ?? "http://localhost:8081";

    if (!resendApiKey) {
      return json({ error: "RESEND_API_KEY is not configured" }, 500);
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { data: adminRow } = await adminClient
      .from("users")
      .select("is_admin")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (!adminRow?.is_admin) {
      return json({ error: "Admin only" }, 403);
    }

    const body = await req.json();
    const requestId = body?.requestId as string | undefined;
    const forceResend = body?.forceResend === true;

    if (!requestId) {
      return json({ error: "requestId is required" }, 400);
    }

    const { data: request, error: fetchError } = await adminClient
      .from("beta_access_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (fetchError || !request) {
      return json({ error: "Request not found" }, 404);
    }

    if (request.status !== "approved") {
      return json({ error: "Request is not approved" }, 400);
    }

    if (!request.approval_token) {
      return json({ error: "Approval token missing" }, 400);
    }

    if (request.approval_email_sent_at && !forceResend) {
      return json({
        ok: true,
        skipped: true,
        sentAt: request.approval_email_sent_at,
      });
    }

    const welcomeUrl = buildWelcomeUrl(appUrl, request.approval_token);
    const idempotencyKey = buildApprovalIdempotencyKey(requestId, forceResend);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [request.email],
        subject: "Your Anymarkt beta access is approved",
        html: buildApprovalEmailHtml({ fullName: request.full_name, welcomeUrl }),
        text: `Your Anymarkt beta access is approved. Continue here: ${welcomeUrl}`,
      }),
    });

    const resendBody = await resendResponse.json();
    if (!resendResponse.ok) {
      console.error("[send-beta-approval-email] Resend error:", resendBody);
      return json({ error: resendBody?.message ?? "Failed to send email" }, 502);
    }

    const { error: markError } = await adminClient.rpc("mark_beta_approval_email_sent", {
      p_request_id: requestId,
    });

    if (markError) {
      console.error("[send-beta-approval-email] mark sent error:", markError.message);
    }

    return json({
      ok: true,
      emailId: resendBody.id,
      sentAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[send-beta-approval-email]", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
