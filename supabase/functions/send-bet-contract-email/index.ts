// @ts-nocheck: Deno edge runtime (Supabase).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import {
  buildBetContractEmailHtml,
  buildBetContractIdempotencyKey,
  buildBetContractSubject,
} from "../_shared/bet-contract-email.ts";
import { createEdgeLogger } from "../_shared/edge-logger.ts";

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

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "AnyMarket <onboarding@camella.app>";
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

    const isServiceRole = token === serviceRoleKey;
    let callerUserId: string | null = null;

    if (!isServiceRole) {
      const { data: authData, error: authError } = await userClient.auth.getUser(token);
      if (authError || !authData.user) {
        return json({ error: "Unauthorized" }, 401);
      }
      callerUserId = authData.user.id;
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

    if (!isServiceRole && contract.user_id !== callerUserId) {
      return json({ error: "Forbidden" }, 403);
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

    const snapshot = contract.placed_snapshot ?? {};
    const marketQuestion = snapshot.market?.question ?? "Market";
    const stakeAmount = Number(snapshot.position?.amount ?? 0);
    const currency = snapshot.wallet?.currency ?? "USD";
    const stakeLabel = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(stakeAmount);

    const resolution = contract.resolved_snapshot ?? null;
    const contractUrl = `${appUrl.replace(/\/$/, "")}/contract/${contract.bet_id}`;
    const subject = buildBetContractSubject({
      eventType,
      marketQuestion,
      outcome: resolution?.outcome ?? null,
    });

    const payoutLabel =
      resolution?.payoutAmount != null
        ? new Intl.NumberFormat("en-US", {
            style: "currency",
            currency,
          }).format(Number(resolution.payoutAmount))
        : null;

    const html = buildBetContractEmailHtml({
      contractNumber: contract.contract_number,
      marketQuestion,
      stakeLabel,
      eventType,
      contractUrl,
      outcome: resolution?.outcome ?? null,
      payoutLabel,
    });

    const idempotencyKey = buildBetContractIdempotencyKey(contractId, eventType, forceResend);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [userRow.email],
        subject,
        html,
        text: `${subject}\n${contractUrl}`,
      }),
    });

    const resendBody = await resendResponse.json();
    if (!resendResponse.ok) {
      log.error("Resend API error", { contractId, eventType, resendBody });
      return json({ error: resendBody?.message ?? "Failed to send email", requestId: log.requestId }, 502);
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
      emailId: resendBody.id,
    });

    return json({
      ok: true,
      emailId: resendBody.id,
      sentAt: new Date().toISOString(),
      requestId: log.requestId,
    });
  } catch (error) {
    log.error("unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return json({ error: error instanceof Error ? error.message : "Unexpected error", requestId: log.requestId }, 500);
  }
});
