// @ts-nocheck: Deno edge runtime (Supabase).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { createEdgeLogger } from "../_shared/edge-logger.ts";
import { sendBetContractEmail } from "../_shared/send-bet-contract-email-shared.ts";

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
  const log = createEdgeLogger("send-bet-contract-email");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    log.info("request received", { method: req.method });
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

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

    const body = await req.json();
    const contractId = body?.contractId as string | undefined;
    const eventType = body?.eventType as "placed" | "resolved" | undefined;
    const forceResend = body?.forceResend === true;

    if (!contractId || !eventType) {
      log.warn("missing required fields", { contractId, eventType });
      return json({ error: "contractId and eventType are required" }, 400);
    }

    if (eventType !== "placed" && eventType !== "resolved") {
      return json({ error: "eventType must be placed or resolved" }, 400);
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const isServiceRole = token === serviceRoleKey;

    if (!isServiceRole) {
      const { data: authData, error: authError } = await userClient.auth.getUser(token);
      if (authError || !authData.user) {
        return json({ error: "Unauthorized" }, 401);
      }
    }

    const { data: contract, error: fetchError } = await adminClient
      .from("bet_contracts")
      .select("*")
      .eq("id", contractId)
      .maybeSingle();

    if (fetchError || !contract) {
      log.warn("contract not found", { contractId, message: fetchError?.message });
      return json({ error: "Contract not found" }, 404);
    }

    if (!isServiceRole) {
      const { data: authData } = await userClient.auth.getUser(token);
      if (contract.user_id !== authData.user?.id) {
        return json({ error: "Forbidden" }, 403);
      }
    }

    if (eventType === "resolved" && !contract.resolved_snapshot) {
      return json({ error: "Contract is not resolved yet" }, 400);
    }

    const sentAtField =
      eventType === "placed" ? contract.placed_email_sent_at : contract.resolved_email_sent_at;

    if (sentAtField && !forceResend) {
      log.info("email already sent, skipping", { contractId, eventType, sentAt: sentAtField });
      return json({ ok: true, skipped: true, sentAt: sentAtField, requestId: log.requestId });
    }

    const { data: userRow } = await adminClient
      .from("users")
      .select("email")
      .eq("id", contract.user_id)
      .maybeSingle();

    if (!userRow?.email) {
      return json({ error: "User email not found" }, 400);
    }

    const sendResult = await sendBetContractEmail({
      contract,
      eventType,
      toEmail: userRow.email,
      fromEmail,
      appUrl,
      resendApiKey,
      forceResend,
    });

    if (!sendResult.ok) {
      log.error("Resend failed", { contractId, eventType, message: sendResult.message });
      return json({ error: sendResult.message, requestId: log.requestId }, 502);
    }

    const { error: markError } = await adminClient.rpc("mark_bet_contract_email_sent", {
      p_contract_id: contractId,
      p_event_type: eventType,
    });

    if (markError) {
      log.error("mark sent RPC failed", { contractId, eventType, message: markError.message });
      return json(
        { error: "Email sent but failed to record delivery timestamp", requestId: log.requestId },
        502,
      );
    }

    log.info("email sent", {
      contractId,
      betId: contract.bet_id,
      eventType,
      hasAttachment: sendResult.hasAttachment,
    });

    return json({
      ok: true,
      emailId: sendResult.id,
      sentAt: new Date().toISOString(),
      hasAttachment: sendResult.hasAttachment,
      requestId: log.requestId,
    });
  } catch (error) {
    log.error("unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return json({ error: error instanceof Error ? error.message : "Unexpected error", requestId: log.requestId }, 500);
  }
});
