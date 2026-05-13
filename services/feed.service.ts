import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type {
    Market,
    MarketInsert,
    MarketOptionInsert,
    MarketWithStats,
} from "../types/market";

/**
 * Feed categories
 */
export const FEED_CATEGORIES = ["Politics", "Tech", "Entertainment"] as const;
export type FeedCategory = (typeof FEED_CATEGORIES)[number];

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
            const { data: markets, error } = await supabase
                .from("markets")
                .select("*, creator:users(username, avatar_url)")
                .eq("is_public", true)
                .eq("status", "open") // Only show active markets, exclude resolved/closed/cancelled
                .order("featured_at", { ascending: false, nullsFirst: false })
                .order("created_at", { ascending: false })
                .limit(limit);

            if (error) {
                console.error("Error fetching public markets:", error);
                return [];
            }

            return (markets || []) as Market[];
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
            const { data: markets, error } = await supabase
                .from("markets")
                .select("*, creator:users(username, avatar_url)")
                .eq("is_public", true)
                .eq("status", "open") // Only show active markets, exclude resolved/closed/cancelled
                .order("created_at", { ascending: false })
                .limit(limit * 2); // Fetch extra for scoring

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

            return scoredMarkets.slice(0, limit).map((s) => s.market);
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

            // Create market (no group, is_public = true)
            const marketInsert: MarketInsert & { market_type: string } = {
                creator_id: user.id,
                group_id: null, // Public markets don't belong to a group
                question: data.question,
                description: data.description,
                category: data.category,
                closes_at: data.closesAt.toISOString(),
                status: "open",
                is_public: true,
                featured_at: new Date().toISOString(),
                image_url: data.imageUrl,
                market_type: data.marketType,
            };

            const { data: market, error: marketError } = await supabase
                .from("markets")
                .insert(marketInsert)
                .select()
                .single();

            if (marketError || !market) {
                return {
                    market: null,
                    error: marketError || new Error("Failed to create market"),
                };
            }

            // Create options
            const optionsInsert: MarketOptionInsert[] = data.options.map(
                (label) => ({
                    market_id: market.id,
                    label,
                    total_pool: 0,
                }),
            );

            const { error: optionsError } = await supabase
                .from("options")
                .insert(optionsInsert);

            if (optionsError) {
                // Clean up market if options creation fails
                await supabase.from("markets").delete().eq("id", market.id);
                return { market: null, error: optionsError };
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
        const channel = supabase
            .channel("public-feed")
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
                .select("*, creator:users(username, avatar_url)")
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
};
