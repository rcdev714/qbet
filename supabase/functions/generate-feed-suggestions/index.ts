// @ts-nocheck: Deno edge runtime (Supabase).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { createEdgeLogger } from "../_shared/edge-logger.ts";
import { scoreSuggestionForAutopilot } from "../_shared/feed-suggestion-resolution.ts";
import {
    generateFeedSuggestionsWithGemini,
    getAmericaNewYorkParts,
    resolveFeedSuggestionSlot,
    type FeedSuggestionSlot,
} from "../_shared/gemini-feed-suggestions.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalizeForDuplicateCheck(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3),
  );
}

function calculateDuplicateScore(question: string, existingQuestions: string[]): number {
  const current = normalizeForDuplicateCheck(question);
  if (current.size === 0) return 0;

  let highest = 0;
  for (const existing of existingQuestions) {
    const other = normalizeForDuplicateCheck(existing);
    if (other.size === 0) continue;
    let overlap = 0;
    for (const word of current) {
      if (other.has(word)) overlap += 1;
    }
    const score = Math.round((overlap / Math.max(current.size, other.size)) * 100);
    highest = Math.max(highest, score);
  }
  return highest;
}

serve(async (req) => {
  const log = createEdgeLogger("generate-feed-suggestions");

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
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
    const geminiModel = Deno.env.get("GEMINI_FEED_MODEL") ?? "gemini-2.5-flash";

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Missing Supabase configuration" }, 500);
    }
    if (!geminiApiKey) {
      return json({ error: "GEMINI_API_KEY is not set" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const force = body?.force === true;
    const forcedSlot = typeof body?.slot === "string" ? body.slot : undefined;
    const triggeredBy = body?.triggered_by === "pg_cron" ? "pg_cron" : "manual";

    const now = new Date();
    const slot = resolveFeedSuggestionSlot(now, forcedSlot) as FeedSuggestionSlot | null;

    if (!slot && !force) {
      return json({ ok: true, skipped: true, reason: "outside_slot" });
    }

    const effectiveSlot = (slot ?? forcedSlot ?? "08:00") as FeedSuggestionSlot;
    const { runDate } = getAmericaNewYorkParts(now);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: existingBatch } = await adminClient
      .from("feed_suggestion_batches")
      .select("id, status")
      .eq("run_date", runDate)
      .eq("cron_slot", effectiveSlot)
      .maybeSingle();

    if (existingBatch?.status === "completed" && !force) {
      return json({ ok: true, skipped: true, reason: "already_completed", batchId: existingBatch.id });
    }

    let batchId = existingBatch?.id as string | undefined;

    if (batchId && force) {
      await adminClient.from("feed_market_suggestions").delete().eq("batch_id", batchId);
      await adminClient
        .from("feed_suggestion_batches")
        .update({
          status: "running",
          triggered_by: triggeredBy,
          suggestion_count: 0,
          error_message: null,
          gemini_model: geminiModel,
          started_at: now.toISOString(),
          completed_at: null,
        })
        .eq("id", batchId);
    } else if (!batchId) {
      const { data: insertedBatch, error: batchError } = await adminClient
        .from("feed_suggestion_batches")
        .insert({
          cron_slot: effectiveSlot,
          run_date: runDate,
          status: "running",
          triggered_by: triggeredBy,
          gemini_model: geminiModel,
          started_at: now.toISOString(),
        })
        .select("id")
        .single();

      if (batchError || !insertedBatch) {
        if (batchError?.code === "23505") {
          return json({ ok: true, skipped: true, reason: "already_running_or_completed" });
        }
        throw new Error(batchError?.message ?? "Failed to create suggestion batch");
      }

      batchId = insertedBatch.id;
    } else {
      await adminClient
        .from("feed_suggestion_batches")
        .update({
          status: "running",
          error_message: null,
          gemini_model: geminiModel,
          started_at: now.toISOString(),
          completed_at: null,
        })
        .eq("id", batchId);
    }

    try {
      const geminiResult = await generateFeedSuggestionsWithGemini({
        apiKey: geminiApiKey,
        model: geminiModel,
        now,
      });

      const { data: recentSuggestions } = await adminClient
        .from("feed_market_suggestions")
        .select("question")
        .order("created_at", { ascending: false })
        .limit(100);

      const { data: recentMarkets } = await adminClient
        .from("markets")
        .select("question")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(100);

      const existingQuestions = [
        ...(recentSuggestions ?? []).map((row) => String(row.question ?? "")),
        ...(recentMarkets ?? []).map((row) => String(row.question ?? "")),
      ];

      const rows = geminiResult.suggestions.map((suggestion) => {
        const fallbackSourceUrls = suggestion.evidenceSources.map((source) => source.url);
        const duplicateScore = calculateDuplicateScore(suggestion.question, existingQuestions);
        const autopilot = scoreSuggestionForAutopilot({ suggestion, now, duplicateScore });

        return {
          batch_id: batchId,
          category: suggestion.category,
          subject: suggestion.subject,
          horizon: suggestion.horizon,
          question: suggestion.question,
          description: suggestion.description,
          options: suggestion.options,
          suggested_closes_at: autopilot.suggestedClosesAt,
          source_urls: fallbackSourceUrls.length ? fallbackSourceUrls : geminiResult.sourceUrls,
          search_queries: geminiResult.searchQueries,
          rationale: suggestion.rationale,
          status: "pending",
          evidence_sources: suggestion.evidenceSources,
          resolution_source_url: suggestion.resolutionSourceUrl,
          resolution_criteria: suggestion.resolutionCriteria,
          event_start_at: suggestion.eventStartAt ?? null,
          expected_resolution_at: suggestion.expectedResolutionAt ?? null,
          close_date_reason: suggestion.closeDateReason,
          resolution_date_source_url: suggestion.resolutionDateSourceUrl,
          source_quality_score: autopilot.sourceQualityScore,
          source_count: autopilot.sourceCount,
          has_official_source: autopilot.hasOfficialSource,
          engagement_score: autopilot.engagementScore,
          resolution_quality_score: autopilot.resolutionQualityScore,
          compliance_risk_score: autopilot.complianceRiskScore,
          duplicate_score: autopilot.duplicateScore,
          autopilot_score: autopilot.autopilotScore,
          autopilot_status: autopilot.autopilotStatus,
          autopilot_reasons: autopilot.autopilotReasons,
        };
      });

      const { error: insertError } = await adminClient
        .from("feed_market_suggestions")
        .insert(rows);

      if (insertError) {
        throw new Error(insertError.message);
      }

      await adminClient
        .from("feed_suggestion_batches")
        .update({
          status: "completed",
          suggestion_count: rows.length,
          completed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", batchId);

      log.info("feed suggestions generated", {
        batchId,
        slot: effectiveSlot,
        runDate,
        count: rows.length,
      });

      return json({
        ok: true,
        batchId,
        slot: effectiveSlot,
        runDate,
        suggestionCount: rows.length,
      });
    } catch (generationError) {
      const message = generationError instanceof Error
        ? generationError.message
        : String(generationError);

      await adminClient
        .from("feed_suggestion_batches")
        .update({
          status: "failed",
          error_message: message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", batchId);

      log.error("feed suggestions failed", { batchId, message });
      return json({ error: message, batchId }, 500);
    }
  } catch (error) {
    log.error("unexpected error", { error: String(error) });
    return json({
      error: error instanceof Error ? error.message : "Unexpected error",
    }, 500);
  }
});
