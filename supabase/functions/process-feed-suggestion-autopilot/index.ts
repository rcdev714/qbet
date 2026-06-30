// @ts-nocheck: Deno edge runtime (Supabase).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { createEdgeLogger } from "../_shared/edge-logger.ts";
import { scoreSuggestionForAutopilot } from "../_shared/feed-suggestion-resolution.ts";
import type { NormalizedFeedSuggestion } from "../_shared/gemini-feed-suggestions.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function toBoolean(value: string | undefined, fallback = false): boolean {
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function toPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function suggestionFromRow(row: Record<string, unknown>): NormalizedFeedSuggestion {
  return {
    category: row.category,
    subject: String(row.subject ?? ""),
    horizon: row.horizon,
    question: String(row.question ?? ""),
    description: String(row.description ?? row.question ?? ""),
    options: Array.isArray(row.options) ? row.options.map(String) : [],
    suggestedClosesAt: String(row.suggested_closes_at ?? ""),
    rationale: String(row.rationale ?? ""),
    evidenceSources: Array.isArray(row.evidence_sources) ? row.evidence_sources : [],
    resolutionSourceUrl: String(row.resolution_source_url ?? ""),
    resolutionCriteria: String(row.resolution_criteria ?? ""),
    eventStartAt: row.event_start_at ? String(row.event_start_at) : undefined,
    expectedResolutionAt: row.expected_resolution_at ? String(row.expected_resolution_at) : undefined,
    closeDateReason: String(row.close_date_reason ?? ""),
    resolutionDateSourceUrl: String(row.resolution_date_source_url ?? ""),
    engagementScore: Number(row.engagement_score ?? 0),
  } as NormalizedFeedSuggestion;
}

serve(async (req) => {
  const log = createEdgeLogger("process-feed-suggestion-autopilot");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    const cronSecret = Deno.env.get("CRON_INVOKER_SECRET") ?? "";
    const token = authHeader?.replace(/^Bearer\s+/i, "") ?? "";

    if (!cronSecret || token !== cronSecret) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Missing Supabase configuration" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const enabled = body?.enabled === true ||
      toBoolean(Deno.env.get("AUTOPILOT_FEED_SUGGESTIONS_ENABLED"), false);
    const maxMarkets = Math.min(
      toPositiveInteger(String(body?.max_markets ?? ""), toPositiveInteger(Deno.env.get("AUTOPILOT_FEED_MAX_MARKETS_PER_RUN"), 1)),
      10,
    );
    const minScore = toPositiveInteger(Deno.env.get("AUTOPILOT_FEED_MIN_SCORE"), 85);
    const allowedCategories = (Deno.env.get("AUTOPILOT_FEED_ALLOWED_CATEGORIES") ?? "Entertainment,Tech,Economy")
      .split(",")
      .map((category) => category.trim())
      .filter(Boolean);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: candidates, error } = await adminClient
      .from("feed_market_suggestions")
      .select("*")
      .eq("status", "pending")
      .eq("autopilot_status", "eligible")
      .gte("autopilot_score", minScore)
      .in("category", allowedCategories)
      .order("autopilot_score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(maxMarkets);

    if (error) throw error;

    const evaluated = [];
    const created = [];
    const blocked = [];
    const now = new Date();

    for (const row of candidates ?? []) {
      const suggestion = suggestionFromRow(row);
      const score = scoreSuggestionForAutopilot({
        suggestion,
        now,
        duplicateScore: Number(row.duplicate_score ?? 0),
      });

      evaluated.push({ id: row.id, score: score.autopilotScore, status: score.autopilotStatus });

      if (score.autopilotStatus !== "eligible" || score.autopilotScore < minScore) {
        blocked.push({ id: row.id, reasons: score.autopilotReasons });
        await adminClient
          .from("feed_market_suggestions")
          .update({
            autopilot_status: "blocked",
            autopilot_reasons: score.autopilotReasons,
            autopilot_score: score.autopilotScore,
            resolution_quality_score: score.resolutionQualityScore,
          })
          .eq("id", row.id);
        continue;
      }

      if (!enabled) continue;

      const { data: market, error: createError } = await adminClient.rpc(
        "autopilot_create_feed_market_from_suggestion",
        { p_suggestion_id: row.id },
      );
      if (createError) {
        blocked.push({ id: row.id, reasons: [createError.message] });
        log.error("autopilot create failed", { suggestionId: row.id, message: createError.message });
        continue;
      }

      created.push({ suggestionId: row.id, marketId: market?.id });
    }

    log.info("autopilot processed", {
      enabled,
      evaluated: evaluated.length,
      created: created.length,
      blocked: blocked.length,
    });

    return json({
      ok: true,
      enabled,
      evaluated,
      created,
      blocked,
    });
  } catch (error) {
    log.error("unexpected error", { error: String(error) });
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
