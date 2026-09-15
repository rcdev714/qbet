import { isSportsMarketCategory } from "@/lib/compliance/market-category";
import { scanMarketTextForSports } from "@/lib/compliance/sports-content";
import { MARKET_WITH_CREATOR_SELECT } from "@/lib/supabase-embeds";
import { createPostgresChannel } from "@/lib/supabase-realtime";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Json } from "../types/database";
import type {
    Market,
    MarketWithStats,
} from "../types/market";

/**
 * Feed categories (display labels; mapped to compliance taxonomy on create).
 * Canonical mapping also lives in `market_category_mappings` (see get_compliance_config RPC).
 */
export const FEED_CATEGORIES = ["Politics", "Tech", "Entertainment", "Economy"] as const;
export type FeedCategory = (typeof FEED_CATEGORIES)[number];

const FEED_TO_COMPLIANCE_CATEGORY: Record<FeedCategory, string> = {
  Politics: "politics",
  Tech: "general_event",
  Entertainment: "general_event",
  Economy: "general_event",
};

export type FeedSuggestionHorizon = "near_term" | "long_term";
export type FeedSuggestionStatus = "pending" | "dismissed" | "created";
export type FeedSuggestionAutopilotStatus =
    | "needs_review"
    | "eligible"
    | "auto_created"
    | "blocked";

export interface FeedSuggestionEvidenceSource {
    url: string;
    title: string;
    publisher: string;
    published_at?: string | null;
    source_type: "official" | "regulatory_filing" | "credible_media" | "social" | "other";
    supports: string;
}

export interface FeedMarketSuggestion {
    id: string;
    batch_id: string;
    category: FeedCategory;
    subject: string;
    horizon: FeedSuggestionHorizon;
    question: string;
    description: string | null;
    options: string[];
    suggested_closes_at: string;
    source_urls: string[];
    search_queries: string[];
    rationale: string | null;
    status: FeedSuggestionStatus;
    evidence_sources: FeedSuggestionEvidenceSource[];
    resolution_source_url: string | null;
    resolution_criteria: string | null;
    event_start_at: string | null;
    expected_resolution_at: string | null;
    close_date_reason: string | null;
    resolution_date_source_url: string | null;
    source_quality_score: number;
    source_count: number;
    has_official_source: boolean;
    engagement_score: number;
    resolution_quality_score: number;
    compliance_risk_score: number;
    duplicate_score: number;
    autopilot_score: number;
    autopilot_status: FeedSuggestionAutopilotStatus;
    autopilot_reasons: string[];
    admin_feedback_reason: string | null;
    created_market_id: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    created_at: string;
    batch?: {
        cron_slot: string;
        run_date: string;
        status: string;
    } | null;
}

export interface FeedSuggestionBatch {
    id: string;
    cron_slot: string;
    run_date: string;
    status: string;
    triggered_by: string;
    suggestion_count: number;
    error_message: string | null;
    gemini_model: string | null;
    started_at: string;
    completed_at: string | null;
}

function normalizeMarketOptionLabels(options: string[]): string[] | Error {
  const labels = options.map((label) => label.trim()).filter(Boolean);
  if (labels.length < 2) {
    return new Error("At least two options required");
  }
  return labels;
}

async function getViewerJurisdiction(): Promise<"EC" | "US"> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return "EC";

  const { data } = await (supabase as any).rpc("get_user_compliance_jurisdiction", {
    p_user_id: user.id,
  });
  return data === "US" ? "US" : "EC";
}

function passesComplianceFeedFilter(
  market: Record<string, unknown>,
  jurisdiction: "EC" | "US",
): boolean {
  if (market.public_feed_allowed !== true) return false;
  if (market.compliance_review_state && market.compliance_review_state !== "approved") {
    return false;
  }
  if (market.sensitivity_tier === "prohibited") return false;

  if (jurisdiction === "EC") {
    const categoryRaw = String(market.market_category || market.category || "");
    if (isSportsMarketCategory(categoryRaw)) return false;

    const textScan = scanMarketTextForSports({
      question: String(market.question || ""),
      description: String(market.description || ""),
      resolutionSource: String(market.resolution_source || ""),
      category: categoryRaw,
    });
    if (textScan.blocked) return false;
  }
  return true;
}

/**
 * User category scores for recommendations
 */
interface CategoryScore {
    category: string;
    totalViews: number;
    totalDurationMs: number;
    score: number;
}

/**
 * Feed service
 * Handles PUBLIC prediction market feed curation, recommendations, and engagement.
 *
 * PUBLIC MARKETS:
 * - Visible to ALL authenticated users
 * - Created by admins via createPublicMarket()
 * - Anyone can place bets using betService.placeBet()
 * - group_id is NULL, is_public is TRUE
 *
 * @see groupService for PRIVATE group-based markets
 */
export const feedService = {
    /**
     * Get public markets for the feed
     * Ordered by featured_at (curated) then created_at
     */
    async getPublicMarkets(limit = 20): Promise<Market[]> {
        try {
            const jurisdiction = await getViewerJurisdiction();
            const { data: markets, error } = await supabase
                .from("markets")
                .select(MARKET_WITH_CREATOR_SELECT)
                .eq("is_public", true)
                .eq("status", "open")
                .eq("public_feed_allowed", true)
                .eq("compliance_review_state", "approved")
                .order("featured_at", { ascending: false, nullsFirst: false })
                .order("created_at", { ascending: false })
                .limit(limit * 2);

            if (error) {
                console.error("Error fetching public markets:", error);
                return [];
            }

            return ((markets || []) as Market[])
                .filter((m) => passesComplianceFeedFilter(m as unknown as Record<string, unknown>, jurisdiction))
                .slice(0, limit);
        } catch (error) {
            console.error("Error fetching public markets:", error);
            return [];
        }
    },

    /**
     * Get recommended markets for a user based on engagement history
     */
    async getRecommendedMarkets(userId: string, limit = 20): Promise<Market[]> {
        try {
            // Get user's category scores
            const scores = await this.getUserCategoryScores(userId);

            if (scores.length === 0) {
                // No engagement history, fall back to regular feed
                return this.getPublicMarkets(limit);
            }

            // Fetch all public markets (only open ones)
            const jurisdiction = await getViewerJurisdiction();
            const { data: markets, error } = await supabase
                .from("markets")
                .select(MARKET_WITH_CREATOR_SELECT)
                .eq("is_public", true)
                .eq("status", "open")
                .eq("public_feed_allowed", true)
                .eq("compliance_review_state", "approved")
                .order("created_at", { ascending: false })
                .limit(limit * 2);

            if (error || !markets) {
                return this.getPublicMarkets(limit);
            }

            // Create category score map
            const scoreMap = new Map(scores.map((s) => [s.category, s.score]));

            // Score and sort markets
            const scoredMarkets = markets.map((market) => ({
                market,
                score: scoreMap.get(market.category || "") || 0,
                recency: Date.now() -
                    new Date(market.created_at || "").getTime(),
            }));

            // Sort by score (higher first), then by recency (newer first)
            scoredMarkets.sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return a.recency - b.recency;
            });

            return scoredMarkets
                .filter(({ market }) =>
                    passesComplianceFeedFilter(market as unknown as Record<string, unknown>, jurisdiction)
                )
                .slice(0, limit)
                .map((s) => s.market as Market);
        } catch (error) {
            console.error("Error fetching recommended markets:", error);
            return this.getPublicMarkets(limit);
        }
    },

    /**
     * Get user's category affinity scores based on engagement
     */
    async getUserCategoryScores(userId: string): Promise<CategoryScore[]> {
        try {
            const { data, error } = await supabase
                .from("user_engagement")
                .select("category, views, view_duration_ms")
                .eq("user_id", userId);

            if (error || !data) return [];

            // Aggregate by category
            const categoryMap = new Map<
                string,
                { views: number; duration: number }
            >();

            for (const row of data) {
                const cat = row.category || "Other";
                const existing = categoryMap.get(cat) || {
                    views: 0,
                    duration: 0,
                };
                categoryMap.set(cat, {
                    views: existing.views + (row.views || 0),
                    duration: existing.duration + (row.view_duration_ms || 0),
                });
            }

            // Calculate scores (weighted: duration matters more than views)
            const scores: CategoryScore[] = [];
            for (const [category, stats] of categoryMap) {
                const score = stats.views * 0.3 + (stats.duration / 1000) * 0.7;
                scores.push({
                    category,
                    totalViews: stats.views,
                    totalDurationMs: stats.duration,
                    score,
                });
            }

            return scores.sort((a, b) => b.score - a.score);
        } catch (error) {
            console.error("Error getting category scores:", error);
            return [];
        }
    },

    /**
     * Track user engagement with a market
     */
    async trackEngagement(
        userId: string,
        marketId: string,
        category: string | null,
        durationMs: number,
    ): Promise<void> {
        try {
            const { error } = await supabase.rpc("upsert_engagement", {
                p_user_id: userId,
                p_market_id: marketId,
                p_category: category || "Other",
                p_duration_ms: durationMs,
            });

            if (error) {
                // Ignore "market not found" error (code 23503) which happens if market was deleted while user was viewing
                if (error.code === "23503") return;
                console.error("Error tracking engagement:", error);
            }
        } catch (error) {
            console.error("Error tracking engagement:", error);
        }
    },

    /**
     * Promote a market to the public feed (admin RPC — sets compliance + visibility).
     */
    async promoteMarketToFeed(marketId: string): Promise<Error | null> {
        try {
            const { error } = await (supabase as any).rpc(
                "admin_promote_market_to_feed",
                { p_market_id: marketId },
            );
            return error;
        } catch (error) {
            return error as Error;
        }
    },

    /**
     * Approve a public market for feed visibility (admin RPC).
     */
    async approveMarketForFeed(marketId: string): Promise<Error | null> {
        try {
            const { error } = await (supabase as any).rpc(
                "admin_approve_market_for_feed",
                { p_market_id: marketId },
            );
            return error;
        } catch (error) {
            return error as Error;
        }
    },

    /**
     * Toggle a market's public status (Admin only)
     */
    async toggleMarketPublicStatus(
        marketId: string,
        isPublic: boolean,
    ): Promise<Error | null> {
        try {
            const { error } = await supabase
                .from("markets")
                .update({
                    is_public: isPublic,
                    featured_at: isPublic ? new Date().toISOString() : null,
                })
                .eq("id", marketId);

            return error;
        } catch (error) {
            return error as Error;
        }
    },

    async createPublicMarket(data: {
        question: string;
        category: FeedCategory;
        options: string[];
        closesAt: Date;
        imageUrl?: string;
        description?: string;
        marketType: "binary" | "multi_option";
    }): Promise<{ market: Market | null; error: Error | null }> {
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                return { market: null, error: new Error("Not authenticated") };
            }

            const labels = normalizeMarketOptionLabels(data.options);
            if (labels instanceof Error) {
                return { market: null, error: labels };
            }

            const complianceCategory = FEED_TO_COMPLIANCE_CATEGORY[data.category] ?? "general_event";
            const { data: market, error: createError } = await supabase.rpc(
                "create_market_with_options",
                {
                    p_question: data.question,
                    p_labels: labels,
                    p_description: data.description,
                    p_closes_at: data.closesAt.toISOString(),
                    p_image_url: data.imageUrl,
                    p_status: "open",
                    p_is_public: true,
                    p_featured_at: new Date().toISOString(),
                    p_category: data.category,
                    p_market_type: data.marketType,
                    p_compliance_category: complianceCategory,
                    p_resolution_source: data.description?.trim() || "Creator-declared public source at market creation",
                    p_creator_attestation: true,
                    p_resolver_type: "creator_source",
                    p_metadata: { feed_category: data.category },
                },
            );

            if (createError || !market) {
                return {
                    market: null,
                    error: createError || new Error("Failed to create market"),
                };
            }

            return { market: market as Market, error: null };
        } catch (error) {
            return { market: null, error: error as Error };
        }
    },

    /**
     * Update an existing public market (Admin only)
     */
    async updatePublicMarket(
        marketId: string,
        data: {
            question?: string;
            category?: FeedCategory;
            closesAt?: Date;
            imageUrl?: string;
            description?: string;
        },
    ): Promise<Error | null> {
        try {
            const updates: any = {};
            if (data.question) updates.question = data.question;
            if (data.category) updates.category = data.category;
            if (data.closesAt) updates.closes_at = data.closesAt.toISOString();
            if (data.imageUrl !== undefined) updates.image_url = data.imageUrl;
            if (data.description !== undefined) {
                updates.description = data.description; // Allow update if provided
            }

            const { error } = await supabase
                .from("markets")
                .update(updates)
                .eq("id", marketId);

            return error;
        } catch (error) {
            return error as Error;
        }
    },

    /**
     * Delete a public market (Admin only)
     */
    async deletePublicMarket(marketId: string): Promise<Error | null> {
        try {
            const { error } = await supabase
                .from("markets")
                .delete()
                .eq("id", marketId);

            return error;
        } catch (error) {
            return error as Error;
        }
    },

    /**
     * Subscribe to public feed updates
     */
    subscribeToPublicFeed(callback: () => void): RealtimeChannel {
        const channel = createPostgresChannel("public-feed")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "markets",
                    filter: "is_public=eq.true",
                },
                () => {
                    callback();
                },
            )
            .subscribe();

        return channel;
    },

    /**
     * Get a public market with full statistics (pool totals, bet counts)
     */
    async getMarketWithStats(
        marketId: string,
    ): Promise<MarketWithStats | null> {
        try {
            // Get market
            const { data: market, error } = await supabase
                .from("markets")
                .select(MARKET_WITH_CREATOR_SELECT)
                .eq("id", marketId)
                .eq("is_public", true)
                .single();

            if (error || !market) return null;

            // Get options and bets to calculate stats
            const { data: options } = await supabase
                .from("options")
                .select("*")
                .eq("market_id", marketId);

            const { count: betCount } = await supabase
                .from("bets")
                .select("*", { count: "exact", head: true })
                .eq("market_id", marketId);

            const { data: bets } = await supabase
                .from("bets")
                .select("option_id, amount, placed_at")
                .eq("market_id", marketId)
                .order("placed_at", { ascending: false })
                .limit(30);

            const safeOptions = options || [];
            const safeBets = bets || [];

            const totalPool = safeOptions.reduce((sum, opt) => {
                const yesPool = Number(opt.yes_pool ?? opt.total_pool ?? 0);
                const noPool = Number(opt.no_pool ?? 0);
                return sum + yesPool + noPool;
            }, 0);

            const optionStats = safeOptions.map((opt) => {
                const yesPool = Number(opt.yes_pool ?? opt.total_pool ?? 0);
                const noPool = Number(opt.no_pool ?? 0);
                const optionTotal = yesPool + noPool;

                // Percentage = option's share of total market pool (this IS the probability)
                const percentage = totalPool > 0
                    ? (optionTotal / totalPool) * 100
                    : 0;

                // YES price = option's probability (its share of total market)
                // NO price = complement (probability this option loses)
                // Example: Thor at 17% -> YES 17¢, NO 83¢
                const numOptions = safeOptions.length;
                let yesPrice = totalPool > 0
                    ? optionTotal / totalPool
                    : (1 / numOptions);
                let noPrice = 1 - yesPrice;

                // Clamp to avoid 0¢ or 100¢ extremes
                const MIN_PRICE = 0.01;
                const MAX_PRICE = 0.99;
                if (yesPrice < MIN_PRICE) {
                    yesPrice = MIN_PRICE;
                    noPrice = MAX_PRICE;
                } else if (yesPrice > MAX_PRICE) {
                    yesPrice = MAX_PRICE;
                    noPrice = MIN_PRICE;
                }

                return {
                    optionId: opt.id,
                    label: opt.label || "Option",
                    yesPool,
                    noPool,
                    percentage,
                    yesPrice,
                    noPrice,
                };
            }).sort((a, b) => b.percentage - a.percentage);

            const recentBets = safeBets.map((b) => ({
                optionId: b.option_id,
                amount: b.amount,
                placedAt: b.placed_at,
            })).reverse(); // Oldest first for graph calculation

            return {
                ...market,
                totalPool,
                betCount: betCount || 0,
                optionStats,
                recentBets,
            } as MarketWithStats;
        } catch (error) {
            console.error("Error getting market stats:", error);
            return null;
        }
    },

    /**
     * Get count of active public markets
     */
    async getPublicMarketCount(): Promise<number> {
        try {
            const { count, error } = await supabase
                .from("markets")
                .select("*", { count: "exact", head: true })
                .eq("is_public", true)
                .eq("status", "open");

            return count || 0;
        } catch (error) {
            return 0;
        }
    },

    /**
     * Resolve a public market (Admin only)
     * Sets the winning option and distributes payouts to all participants
     * @param marketId - The market to resolve
     * @param winningOptionId - The option that won
     * @param evidenceUrl - Optional URL to proof source
     * @param evidenceNotes - Optional admin notes explaining the resolution
     */
    async resolvePublicMarket(
        marketId: string,
        winningOptionId: string,
        evidenceUrl?: string,
        evidenceNotes?: string,
    ): Promise<{ market: Market | null; error: Error | null }> {
        try {
            // Note: resolve_public_market RPC function is defined in migration
            // TypeScript types will update after running: supabase gen types
            const { data, error } = await supabase.rpc(
                "resolve_public_market" as any,
                {
                    p_market_id: marketId,
                    p_winning_option_id: winningOptionId,
                    p_evidence_url: evidenceUrl || undefined,
                    p_evidence_notes: evidenceNotes || undefined,
                },
            );

            if (error) {
                return { market: null, error };
            }

            // Fetch the updated market
            const { data: market } = await supabase
                .from("markets")
                .select("*")
                .eq("id", marketId)
                .single();

            await this.dispatchMarketNotifications(marketId);

            return { market: market as Market, error: null };
        } catch (error) {
            return { market: null, error: error as Error };
        }
    },

    /**
     * Get options for a public market
     */
    async getMarketOptions(
        marketId: string,
    ): Promise<{ id: string; label: string; total_pool: number }[]> {
        try {
            const { data: options, error } = await supabase
                .from("options")
                .select("id, label, total_pool")
                .eq("market_id", marketId)
                .order("created_at", { ascending: true });

            if (error) {
                console.error("Error fetching market options:", error);
                return [];
            }

            // Map options to ensure non-null values
            return (options || []).map((opt) => ({
                id: opt.id,
                label: opt.label || "Option",
                total_pool: opt.total_pool || 0,
            }));
        } catch (error) {
            console.error("Error fetching market options:", error);
            return [];
        }
    },

    async dispatchMarketNotifications(marketId: string): Promise<void> {
        try {
            await supabase.functions.invoke("dispatch-notification", {
                body: { marketId },
            });
        } catch (error) {
            console.warn("dispatch-notification failed for public market", error);
        }
    },

    async getFeedSuggestions(params?: {
        status?: FeedSuggestionStatus;
        limit?: number;
    }): Promise<{ suggestions: FeedMarketSuggestion[]; error: Error | null }> {
        try {
            let query = supabase
                .from("feed_market_suggestions")
                .select(`
                    *,
                    batch:feed_suggestion_batches(cron_slot, run_date, status)
                `)
                .order("created_at", { ascending: false })
                .limit(params?.limit ?? 100);

            if (params?.status) {
                query = query.eq("status", params.status);
            }

            const { data, error } = await query;
            if (error) {
                return { suggestions: [], error };
            }

            const suggestions = (data ?? []).map((row) => ({
                ...row,
                options: Array.isArray(row.options) ? row.options.map(String) : [],
                source_urls: Array.isArray(row.source_urls) ? row.source_urls.map(String) : [],
                search_queries: Array.isArray(row.search_queries)
                    ? row.search_queries.map(String)
                    : [],
                evidence_sources: Array.isArray(row.evidence_sources)
                    ? row.evidence_sources
                    : [],
                autopilot_reasons: Array.isArray(row.autopilot_reasons)
                    ? row.autopilot_reasons.map(String)
                    : [],
            })) as unknown as FeedMarketSuggestion[];

            return { suggestions, error: null };
        } catch (error) {
            return { suggestions: [], error: error as Error };
        }
    },

    async getFeedSuggestionBatches(limit = 20): Promise<{
        batches: FeedSuggestionBatch[];
        error: Error | null;
    }> {
        try {
            const { data, error } = await supabase
                .from("feed_suggestion_batches")
                .select("*")
                .order("started_at", { ascending: false })
                .limit(limit);

            if (error) {
                return { batches: [], error };
            }

            return { batches: (data ?? []) as FeedSuggestionBatch[], error: null };
        } catch (error) {
            return { batches: [], error: error as Error };
        }
    },

    async dismissFeedSuggestion(
        id: string,
        feedbackReason?: string,
    ): Promise<Error | null> {
        try {
            const { error } = await supabase.rpc("admin_dismiss_feed_suggestion", {
                p_id: id,
                p_feedback_reason: feedbackReason || null,
            });
            return error;
        } catch (error) {
            return error as Error;
        }
    },

    async markSuggestionCreated(
        id: string,
        marketId: string,
        editSnapshot?: Record<string, unknown>,
    ): Promise<Error | null> {
        try {
            const { error } = await supabase.rpc("admin_mark_suggestion_created", {
                p_id: id,
                p_market_id: marketId,
                p_admin_edit_snapshot: (editSnapshot ?? null) as Json | null,
            });
            return error;
        } catch (error) {
            return error as Error;
        }
    },
};
