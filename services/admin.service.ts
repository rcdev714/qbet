import { supabase } from "../lib/supabase";

export interface KPISummary {
    totalUsers: number;
    totalBets: number;
    totalVolume: number;
    activeMarkets: number;
    betsPerUser: number;
    predictionsPerUser: number;
}

export interface GrowthMetric {
    date: string;
    count: number;
}

export interface FraudAlert {
    userId: string;
    username: string;
    reason: string;
    severity: "low" | "medium" | "high";
    details: string;
}

export const adminService = {
    /**
     * Get high-level KPI summary
     */
    async getKPISummary(): Promise<KPISummary> {
        try {
            // 1. Total Users
            const { count: totalUsers, error: usersError } = await supabase
                .from("users")
                .select("*", { count: "exact", head: true });

            if (usersError) throw usersError;

            // 2. Total Bets & Volume
            const { data: betsData, error: betsError } = await supabase
                .from("bets")
                .select("amount")
                .eq("is_play_mode", false); // Real money only

            if (betsError) throw betsError;

            const totalBets = betsData.length;
            const totalVolume = betsData.reduce(
                (sum: number, bet: any) => sum + Number(bet.amount),
                0,
            );

            // 3. Active Markets
            const { count: activeMarkets, error: marketsError } = await supabase
                .from("markets")
                .select("*", { count: "exact", head: true })
                .eq("status", "open");

            if (marketsError) throw marketsError;

            // 4. Per User Metrics
            const userCount = totalUsers || 1; // Avoid division by zero
            const betsPerUser = totalBets / userCount;
            // "Predictions" here maps to bets for now, but could distinction if needed
            const predictionsPerUser = betsPerUser;

            return {
                totalUsers: totalUsers || 0,
                totalBets,
                totalVolume,
                activeMarkets: activeMarkets || 0,
                betsPerUser,
                predictionsPerUser,
            };
        } catch (error) {
            console.error("Error fetching KPI summary:", error);
            return {
                totalUsers: 0,
                totalBets: 0,
                totalVolume: 0,
                activeMarkets: 0,
                betsPerUser: 0,
                predictionsPerUser: 0,
            };
        }
    },

    /**
     * Get user growth over time (daily)
     * limit: number of days to look back
     */
    async getUserGrowth(limit: number = 30): Promise<GrowthMetric[]> {
        try {
            const today = new Date();
            const startDate = new Date(today);
            startDate.setDate(today.getDate() - limit);

            const { data, error } = await supabase
                .from("users")
                .select("created_at")
                .gte("created_at", startDate.toISOString())
                .order("created_at", { ascending: true });

            if (error) throw error;

            // Aggregate by day
            const growthMap = new Map<string, number>();

            // Initialize all days with 0
            for (let i = 0; i <= limit; i++) {
                const d = new Date(startDate);
                d.setDate(startDate.getDate() + i);
                const dateKey = d.toISOString().split("T")[0];
                growthMap.set(dateKey, 0);
            }

            data.forEach((user: any) => {
                const dateKey =
                    new Date(user.created_at).toISOString().split("T")[0];
                if (growthMap.has(dateKey)) {
                    growthMap.set(dateKey, (growthMap.get(dateKey) || 0) + 1);
                }
            });

            // Convert to cumulative array
            const result: GrowthMetric[] = [];
            let cumulative = 0;

            // We need a base count of users before the start date for accurate cumulative graph
            const { count: baseCount } = await supabase
                .from("users")
                .select("*", { count: "exact", head: true })
                .lt("created_at", startDate.toISOString());

            cumulative = baseCount || 0;

            Array.from(growthMap.entries()).sort().forEach(([date, count]) => {
                cumulative += count;
                result.push({ date, count: cumulative });
            });

            return result;
        } catch (error) {
            console.error("Error fetching user growth:", error);
            return [];
        }
    },

    /**
     * Get betting volume over time (daily)
     */
    async getBettingVolume(limit: number = 30): Promise<GrowthMetric[]> {
        try {
            const today = new Date();
            const startDate = new Date(today);
            startDate.setDate(today.getDate() - limit);

            const { data, error } = await supabase
                .from("bets")
                .select("created_at:placed_at, amount") // mapping placed_at to created_at for consistency
                .eq("is_play_mode", false) // Real money only
                .gte("placed_at", startDate.toISOString())
                .order("placed_at", { ascending: true });

            if (error) throw error;

            // Aggregate by day
            const volumeMap = new Map<string, number>();

            // Initialize all days with 0
            for (let i = 0; i <= limit; i++) {
                const d = new Date(startDate);
                d.setDate(startDate.getDate() + i);
                const dateKey = d.toISOString().split("T")[0];
                volumeMap.set(dateKey, 0);
            }

            data.forEach((bet: any) => {
                const dateKey =
                    new Date(bet.created_at).toISOString().split("T")[0];
                volumeMap.set(
                    dateKey,
                    (volumeMap.get(dateKey) || 0) + Number(bet.amount),
                );
            });

            return Array.from(volumeMap.entries())
                .sort()
                .map(([date, count]) => ({ date, count }));
        } catch (error) {
            console.error("Error fetching betting volume:", error);
            return [];
        }
    },

    /**
     * Identify potential fraud or high-risk users
     * - High win rate (> 80% with > 5 bets)
     * - Rapid betting (placeholder logic)
     */
    /**
     * Identify potential fraud or high-risk users using "Palantir-style" heuristics.
     * FILTERS: Real Money Only (is_play_mode = false)
     * 1. Velocity Spikes (Activity explosion)
     * 2. Self-Hedging (Betting on both sides)
     * 3. Syndicate/Collusion (Same bets, same time)
     */
    async getFraudAlerts(): Promise<FraudAlert[]> {
        const alerts: FraudAlert[] = [];
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        try {
            // REMOVED: High Win Rate check (user_stats currently mixes play/real money)
            // We focus on behavioral anomalies in real-money bets only.

            // 1. VELOCITY SPIKES (Activity explosion)
            // Fetch bets from last 24h vs previous 30 days average
            // Note: This is a heavy calculation, we'll do a simplified version:
            // Check top 5 active users in last 24h
            const { data: recentActivity } = await supabase
                .from("bets")
                .select("user_id, placed_at")
                .eq("is_play_mode", false) // Real money only
                .gte("placed_at", yesterday.toISOString());

            if (recentActivity) {
                const userCounts: Record<string, number> = {};
                recentActivity.forEach((bet: any) => {
                    userCounts[bet.user_id] = (userCounts[bet.user_id] || 0) +
                        1;
                });

                // Check those with > 20 bets in 24h
                for (const userId in userCounts) {
                    if (userCounts[userId] > 20) {
                        // In a real implementation effectively, we'd check their historical average.
                        // For now, > 20 bets/day is a sufficient "velocity" trigger for review.
                        // Get username for alert
                        const { data: u } = await supabase.from("users").select(
                            "username",
                        ).eq("id", userId).single();

                        alerts.push({
                            userId: userId,
                            username: u?.username || "Unknown",
                            reason: "Velocity Spike (Real Money)",
                            severity: "medium",
                            details: `${
                                userCounts[userId]
                            } bets placed in last 24h.`,
                        });
                    }
                }
            }

            // 2. SELF-HEDGING (Betting on multiple options in active markets)
            // Get active bets for open markets
            const { data: activeBets } = await supabase
                .from("bets")
                .select("user_id, market_id, option_id, markets!inner(status)")
                .eq("is_play_mode", false) // Real money only
                .eq("markets.status", "open");

            if (activeBets) {
                const userMarketMap: Record<string, Set<string>> = {};

                activeBets.forEach((bet: any) => {
                    const key = `${bet.user_id}-${bet.market_id}`;
                    if (!userMarketMap[key]) userMarketMap[key] = new Set();
                    userMarketMap[key].add(bet.option_id);
                });

                for (const key in userMarketMap) {
                    if (userMarketMap[key].size > 1) {
                        const [userId, marketId] = key.split("-");
                        // Get username
                        const { data: u } = await supabase.from("users").select(
                            "username",
                        ).eq("id", userId).single();

                        alerts.push({
                            userId: userId,
                            username: u?.username || "Unknown",
                            reason: "Arbitrage / Self-Hedging",
                            severity: "high",
                            details: `User bet on multiple outcomes in market ${
                                marketId.slice(0, 8)
                            }...`,
                        });
                    }
                }
            }

            // 3. SYNDICATE DETECTION (Simplified Temporal Clustering)
            // Look for bets placed within 1 minute of each other by different users on same option
            // We reuse 'recentActivity' but need option_id
            const { data: syndicateCandidates } = await supabase
                .from("bets")
                .select("user_id, market_id, option_id, placed_at")
                .eq("is_play_mode", false) // Real money only
                .gte("placed_at", yesterday.toISOString())
                .order("placed_at", { ascending: true });

            if (syndicateCandidates && syndicateCandidates.length > 5) {
                // Sliding window check
                for (let i = 0; i < syndicateCandidates.length; i++) {
                    const current = syndicateCandidates[i];
                    const window: any[] = [current];

                    // Look ahead for bets within 60s
                    for (let j = i + 1; j < syndicateCandidates.length; j++) {
                        const next = syndicateCandidates[j];
                        const timeDiff = new Date(next.placed_at).getTime() -
                            new Date(current.placed_at).getTime();
                        if (timeDiff > 60000) break; // Out of 60s window

                        if (
                            next.market_id === current.market_id &&
                            next.option_id === current.option_id &&
                            next.user_id !== current.user_id
                        ) {
                            window.push(next);
                        }
                    }

                    if (window.length >= 3) {
                        // Syndicate found!
                        const userIds = Array.from(
                            new Set(window.map((b: any) => b.user_id)),
                        );
                        if (userIds.length >= 3) {
                            alerts.push({
                                userId: "SYNDICATE",
                                username: "Multiple Users",
                                reason: "Syndicate/Collusion Ring",
                                severity: "high",
                                details:
                                    `${userIds.length} users bet on same option within 60s. IDs: ${
                                        userIds.map((id) => id.slice(0, 4))
                                            .join(", ")
                                    }`,
                            });
                            // Skip ahead to avoid duplicates
                            i += window.length;
                        }
                    }
                }
            }

            return alerts;
        } catch (error) {
            console.error("Error fetching fraud alerts:", error);
            // Return empty list or fallback alerts rather than crashing
            return [];
        }
    },

    /**
     * Generate an AI image for a market using the question prompt
     */
    async generateMarketImage(prompt: string): Promise<string> {
        try {
            const { data, error } = await supabase.functions.invoke(
                "generate-image",
                {
                    body: { prompt },
                },
            );

            if (error) throw error;

            if (!data?.imageUrl) {
                throw new Error("No image URL returned from generation");
            }

            return data.imageUrl;
        } catch (error: any) {
            console.error("Error generating image:", error);
            throw new Error(error.message || "Failed to generate AI image");
        }
    },
};
