// @ts-nocheck: Deno edge runtime (Supabase).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { createEdgeLogger } from "../_shared/edge-logger.ts";
import { sendBetContractEmail } from "../_shared/send-bet-contract-email-shared.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  const log = createEdgeLogger("dispatch-market-contract-emails");

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
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "Anymarkt <onboarding@anymarkt.com>";
    const appUrl = Deno.env.get("EXPO_PUBLIC_APP_URL") ?? "http://localhost:8081";

    if (!resendApiKey) {
      return json({ error: "RESEND_API_KEY is not configured" }, 500);
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const isServiceRole = token === serviceRoleKey;
    let callerUserId: string | null = null;

    if (!isServiceRole) {
      const { data: authData, error: authError } = await userClient.auth.getUser(token);
      if (authError || !authData.user) {
        return json({ error: "Unauthorized" }, 401);
      }
      callerUserId = authData.user.id;
    }

    const body = await req.json();
    const marketId = body?.marketId as string | undefined;
    if (!marketId) {
      log.warn("missing marketId");
      return json({ error: "marketId is required" }, 400);
    }

    log.debug("dispatching resolution emails", { marketId });

    const { data: market } = await adminClient
      .from("markets")
      .select("id, creator_id, group_id, status")
      .eq("id", marketId)
      .maybeSingle();

    if (!market || market.status !== "resolved") {
      log.warn("market not resolved", { marketId, status: market?.status });
      return json({ error: "Market is not resolved" }, 400);
    }

    if (!isServiceRole && callerUserId) {
      const { data: adminCheck } = await adminClient.rpc("is_group_admin", {
        p_group_id: market.group_id,
        p_user_id: callerUserId,
      });
      const isCreator = market.creator_id === callerUserId;
      const { data: isAdminRow } = await adminClient
        .from("users")
        .select("is_admin")
        .eq("id", callerUserId)
        .maybeSingle();

      if (!isCreator && adminCheck !== true && !isAdminRow?.is_admin) {
        return json({ error: "Forbidden" }, 403);
      }
    }

    const { data: contracts, error: contractsError } = await adminClient
      .from("bet_contracts")
      .select("*")
      .eq("market_id", marketId)
      .not("resolved_snapshot", "is", null);

    if (contractsError) {
      log.error("contract fetch failed", { marketId, message: contractsError.message });
      return json({ error: contractsError.message, requestId: log.requestId }, 500);
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const contract of contracts ?? []) {
      if (contract.resolved_email_sent_at) {
        skipped += 1;
        continue;
      }

      const { data: userRow } = await adminClient
        .from("users")
        .select("email")
        .eq("id", contract.user_id)
        .maybeSingle();

      if (!userRow?.email) continue;

      const sendResult = await sendBetContractEmail({
        contract,
        eventType: "resolved",
        toEmail: userRow.email,
        fromEmail,
        appUrl,
        resendApiKey,
      });

      if (sendResult.ok) {
        await adminClient.rpc("mark_bet_contract_email_sent", {
          p_contract_id: contract.id,
          p_event_type: "resolved",
        });
        sent += 1;
        log.info("resolution email sent", {
          contractId: contract.id,
          betId: contract.bet_id,
          hasAttachment: sendResult.hasAttachment,
        });
      } else {
        failed += 1;
        log.error("resolution email failed", {
          contractId: contract.id,
          betId: contract.bet_id,
          message: sendResult.message,
        });
      }
    }

    log.info("dispatch complete", { marketId, sent, skipped, failed, total: (contracts ?? []).length });

    return json({
      ok: true,
      sent,
      skipped,
      failed,
      total: (contracts ?? []).length,
      requestId: log.requestId,
    });
  } catch (error) {
    log.error("unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return json({ error: error instanceof Error ? error.message : "Unexpected error", requestId: log.requestId }, 500);
  }
});
