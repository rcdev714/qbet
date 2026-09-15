import { logger } from "../lib/logger";
import { supabase } from "../lib/supabase";

export interface KPISummary {
    totalUsers: number;
    totalBets: number;
    totalVolume: number;
    activeMarkets: number;
    betsPerUser: number;
    predictionsPerUser: number;
}

export interface FinancialKPIs {
    totalDeposits: number;
    totalWithdrawals: number;
    walletFloat: number;
    openReports: number;
}

export interface DailyFinancialSeries {
    dates: string[];
    deposits: number[];
    withdrawals: number[];
    betVolume: number[];
}

export type AdminTransactionType =
    | "deposit"
    | "withdrawal"
    | "bet_placed"
    | "bet_won"
    | "bet_refund"
    | "bet_lost"
    | "play_credit_refresh"
    | "transfer_sent"
    | "transfer_received"
    | "crypto_onramp"
    | "crypto_offramp"
    | "provider_fee"
    | "protocol_fee"
    | "tax_withholding";

export interface AdminTransactionRow {
    id: string;
    userId: string | null;
    username: string | null;
    amount: number;
    type: AdminTransactionType;
    status: "pending" | "completed" | "failed";
    referenceId: string | null;
    isPlayMode: boolean;
    metadata: Record<string, unknown> | null;
    createdAt: string;
}

export interface AdminTransactionListResult {
    rows: AdminTransactionRow[];
    totalCount: number;
}

export interface AdminContentReportRow {
    id: string;
    reporterId: string;
    reporterUsername: string | null;
    targetType: string;
    targetId: string;
    targetUserId: string | null;
    targetUsername: string | null;
    reason: string;
    details: string | null;
    status: "open" | "reviewing" | "resolved" | "dismissed";
    adminNotes: string | null;
    createdAt: string;
    resolvedAt: string | null;
}

export interface AdminContentReportListResult {
    rows: AdminContentReportRow[];
    totalCount: number;
}

export interface AdminSocialKPIs {
    totalFollows: number;
    follows7d: number;
    usersWithFollowers: number;
    avgFollowersPerUser: number;
    activeSocialBettors7d: number;
    activeGroups: number;
    groupJoins7d: number;
}

export interface AdminSocialConnector {
    userId: string;
    username: string | null;
    followersCount: number;
    followingCount: number;
    totalBets: number;
    betVolume: number;
    winRate: number;
    groupCount: number;
}

export interface AdminCoBetCluster {
    clusterKey: string;
    clusterType: string;
    label: string;
    userCount: number;
    betCount: number;
    totalVolume: number;
    dominantSide: string | null;
    lastActivity: string;
}

export interface AdminFollowSeries {
    dates: string[];
    counts: number[];
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
            logger.error("Error fetching KPI summary", {}, error);
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
                .select("user_id, market_id, option_id, markets!bets_market_id_fkey!inner(status)")
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

    async getFinancialKPIs(): Promise<FinancialKPIs> {
        const { data, error } = await supabase.rpc(
            "get_admin_financial_kpis",
        );
        if (error) throw error;

        const payload = (data ?? {}) as Record<string, unknown>;

        return {
            totalDeposits: Number(payload.total_deposits ?? 0),
            totalWithdrawals: Number(payload.total_withdrawals ?? 0),
            walletFloat: Number(payload.wallet_float ?? 0),
            openReports: Number(payload.open_reports ?? 0),
        };
    },

    async getDailyFinancialSeries(days: number = 14): Promise<DailyFinancialSeries> {
        const { data, error } = await supabase.rpc(
            "get_admin_daily_financial_series",
            { p_days: days },
        );
        if (error) throw error;

        const payload = (data ?? {}) as Record<string, unknown>;

        return {
            dates: Array.isArray(payload.dates) ? payload.dates.map(String) : [],
            deposits: Array.isArray(payload.deposits) ? payload.deposits.map(Number) : [],
            withdrawals: Array.isArray(payload.withdrawals) ? payload.withdrawals.map(Number) : [],
            betVolume: Array.isArray(payload.bet_volume) ? payload.bet_volume.map(Number) : [],
        };
    },

    async listTransactions(input: {
        limit?: number;
        offset?: number;
        type?: AdminTransactionType | null;
        status?: "pending" | "completed" | "failed" | null;
        isPlayMode?: boolean | null;
        search?: string | null;
    } = {}): Promise<AdminTransactionListResult> {
        const { data, error } = await supabase.rpc(
            "list_admin_transactions",
            {
                p_limit: input.limit ?? 50,
                p_offset: input.offset ?? 0,
                p_type: input.type ?? undefined,
                p_status: input.status ?? undefined,
                p_is_play_mode: input.isPlayMode ?? undefined,
                p_search: input.search ?? undefined,
            },
        );
        if (error) throw error;

        const rows = (data ?? []) as any[];
        const totalCount = rows.length > 0 ? Number(rows[0].total_count ?? 0) : 0;

        return {
            totalCount,
            rows: rows.map((row) => ({
                id: row.id,
                userId: row.user_id ?? null,
                username: row.username ?? null,
                amount: Number(row.amount ?? 0),
                type: row.type,
                status: row.status,
                referenceId: row.reference_id ?? null,
                isPlayMode: Boolean(row.is_play_mode),
                metadata: row.metadata ?? null,
                createdAt: row.created_at,
            })),
        };
    },

    async listContentReports(input: {
        status?: "open" | "reviewing" | "resolved" | "dismissed" | null;
        limit?: number;
        offset?: number;
    } = {}): Promise<AdminContentReportListResult> {
        const { data, error } = await supabase.rpc(
            "list_admin_content_reports",
            {
                p_status: input.status ?? undefined,
                p_limit: input.limit ?? 100,
                p_offset: input.offset ?? 0,
            },
        );
        if (error) throw error;

        const rows = (data ?? []) as any[];
        const totalCount = rows.length > 0 ? Number(rows[0].total_count ?? 0) : 0;

        return {
            totalCount,
            rows: rows.map((row) => ({
                id: row.id,
                reporterId: row.reporter_id,
                reporterUsername: row.reporter_username ?? null,
                targetType: row.target_type,
                targetId: row.target_id,
                targetUserId: row.target_user_id ?? null,
                targetUsername: row.target_username ?? null,
                reason: row.reason,
                details: row.details ?? null,
                status: row.status,
                adminNotes: row.admin_notes ?? null,
                createdAt: row.created_at,
                resolvedAt: row.resolved_at ?? null,
            })),
        };
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

    async getSocialKPIs(): Promise<AdminSocialKPIs> {
        try {
            const { data, error } = await (supabase as any).rpc("get_admin_social_kpis");
            if (error) throw error;
            const row = (data ?? {}) as Record<string, unknown>;
            return {
                totalFollows: Number(row.total_follows ?? 0),
                follows7d: Number(row.follows_7d ?? 0),
                usersWithFollowers: Number(row.users_with_followers ?? 0),
                avgFollowersPerUser: Number(row.avg_followers_per_user ?? 0),
                activeSocialBettors7d: Number(row.active_social_bettors_7d ?? 0),
                activeGroups: Number(row.active_groups ?? 0),
                groupJoins7d: Number(row.group_joins_7d ?? 0),
            };
        } catch (error) {
            logger.error("Error fetching social KPIs", {}, error);
            return {
                totalFollows: 0,
                follows7d: 0,
                usersWithFollowers: 0,
                avgFollowersPerUser: 0,
                activeSocialBettors7d: 0,
                activeGroups: 0,
                groupJoins7d: 0,
            };
        }
    },

    async getFollowSeries(days = 14): Promise<AdminFollowSeries> {
        try {
            const { data, error } = await (supabase as any).rpc("get_admin_follow_series", {
                p_days: days,
            });
            if (error) throw error;
            const row = (data ?? {}) as Record<string, unknown>;
            return {
                dates: ((row.dates as string[]) ?? []).map(String),
                counts: ((row.counts as number[]) ?? []).map(Number),
            };
        } catch (error) {
            logger.error("Error fetching follow series", {}, error);
            return { dates: [], counts: [] };
        }
    },

    async listSocialConnectors(limit = 20): Promise<AdminSocialConnector[]> {
        try {
            const { data, error } = await (supabase as any).rpc("list_admin_social_connectors", {
                p_limit: limit,
            });
            if (error) throw error;
            return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
                userId: String(row.user_id),
                username: (row.username as string | null) ?? null,
                followersCount: Number(row.followers_count ?? 0),
                followingCount: Number(row.following_count ?? 0),
                totalBets: Number(row.total_bets ?? 0),
                betVolume: Number(row.bet_volume ?? 0),
                winRate: Number(row.win_rate ?? 0),
                groupCount: Number(row.group_count ?? 0),
            }));
        } catch (error) {
            logger.error("Error listing social connectors", {}, error);
            return [];
        }
    },

    async listCoBetClusters(limit = 20): Promise<AdminCoBetCluster[]> {
        try {
            const { data, error } = await (supabase as any).rpc("list_admin_co_bet_clusters", {
                p_limit: limit,
            });
            if (error) throw error;
            return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
                clusterKey: String(row.cluster_key),
                clusterType: String(row.cluster_type),
                label: String(row.label ?? ""),
                userCount: Number(row.user_count ?? 0),
                betCount: Number(row.bet_count ?? 0),
                totalVolume: Number(row.total_volume ?? 0),
                dominantSide: (row.dominant_side as string | null) ?? null,
                lastActivity: String(row.last_activity ?? ""),
            }));
        } catch (error) {
            logger.error("Error listing co-bet clusters", {}, error);
            return [];
        }
    },
};
