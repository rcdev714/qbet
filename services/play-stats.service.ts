/**
 * Play Stats Service
 * Reads local play bets from AsyncStorage (localStorage on web)
 * and computes stats/charts data without touching Supabase bets.
 *
 * Market/option metadata is fetched read-only from Supabase
 * to resolve labels, status, and winning options.
 */
const AsyncStorage =
    require("@react-native-async-storage/async-storage").default;
import { supabase } from "../lib/supabase";
import type { Bet, BetWithDetails } from "../types/market";

const PLAY_BETS_KEY = "@qbet_play_bets";

export type PlayBet = Bet & { payout_processed?: boolean };

export interface PlayStats {
    totalWagered: number;
    totalWon: number;
    bestWin: number;
    averageBet: number;
    totalBets: number;
    winRate: number;
}

export const playStatsService = {
    // ─── Raw Access ──────────────────────────────────────────

    /** Get all local play bets */
    async getAllPlayBets(): Promise<PlayBet[]> {
        try {
            const stored = await AsyncStorage.getItem(PLAY_BETS_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    },

    /** Get play bets for a specific user */
    async getPlayBetsForUser(userId?: string): Promise<PlayBet[]> {
        const all = await this.getAllPlayBets();
        if (!userId) {
            const { data: { user } } = await supabase.auth.getUser();
            userId = user?.id;
        }
        if (!userId) return [];
        return all.filter((b) => b.user_id === userId);
    },

    /** Get play bets for a specific market */
    async getPlayBetsForMarket(marketId: string): Promise<PlayBet[]> {
        const all = await this.getAllPlayBets();
        return all.filter((b) => b.market_id === marketId);
    },

    /** Get play bets for a specific user + market */
    async getPlayBetsForUserMarket(
        marketId: string,
        userId?: string,
    ): Promise<PlayBet[]> {
        if (!userId) {
            const { data: { user } } = await supabase.auth.getUser();
            userId = user?.id;
        }
        if (!userId) return [];
        const all = await this.getAllPlayBets();
        return all.filter((b) =>
            b.user_id === userId && b.market_id === marketId
        );
    },

    // ─── Enriched Data ───────────────────────────────────────

    /** Enrich play bets with market/option data from Supabase (read-only) */
    async getPlayBetsWithDetails(userId?: string): Promise<BetWithDetails[]> {
        const playBets = await this.getPlayBetsForUser(userId);
        if (playBets.length === 0) return [];

        // Get unique market IDs
        const marketIds = Array.from(new Set(playBets.map((b) => b.market_id)));

        // Fetch market + option data
        const [{ data: markets }, { data: options }] = await Promise.all([
            supabase
                .from("markets")
                .select("*")
                .in("id", marketIds),
            supabase
                .from("options")
                .select("*")
                .in("market_id", marketIds),
        ]);

        // Build lookup maps
        const marketMap = new Map((markets || []).map((m: any) => [m.id, m]));
        const optionMap = new Map((options || []).map((o: any) => [o.id, o]));

        // Enrich
        return playBets.map((bet) => ({
            ...bet,
            markets: marketMap.get(bet.market_id) || null,
            options: optionMap.get(bet.option_id) || null,
        })) as BetWithDetails[];
    },

    // ─── Aggregate Stats ────────────────────────────────────

    /** Compute aggregate stats from local play bets */
    async getPlayStats(userId?: string): Promise<PlayStats> {
        const betsWithDetails = await this.getPlayBetsWithDetails(userId);

        let totalWagered = 0;
        let totalWon = 0;
        let bestWin = 0;
        let totalResolved = 0;
        let wins = 0;

        betsWithDetails.forEach((bet) => {
            totalWagered += bet.amount;

            if (bet.markets?.status === "resolved") {
                totalResolved++;
                const isWin = bet.markets.winning_option_id === bet.option_id &&
                    bet.side === "yes";

                if (isWin) {
                    // Simplified payout: just use the bet amount as "won"
                    // More accurate would use parimutuel math, but this is play mode
                    const payout = bet.amount * 2; // Simplified
                    totalWon += payout;
                    wins++;
                    if (payout > bestWin) bestWin = payout;
                }
            }
        });

        return {
            totalWagered,
            totalWon,
            bestWin,
            averageBet: betsWithDetails.length > 0
                ? totalWagered / betsWithDetails.length
                : 0,
            totalBets: betsWithDetails.length,
            winRate: totalResolved > 0 ? (wins / totalResolved) * 100 : 0,
        };
    },

    // ─── Chart Data ──────────────────────────────────────────

    /**
     * Compute probability history for a market from play bets.
     * Returns time-series data for each option showing probability changes.
     */
    async getPlayProbabilityData(
        marketId: string,
        optionsList: { id: string; label: string }[],
    ): Promise<{
        datasets: {
            optionId: string;
            label: string;
            data: { value: number; label: string }[];
        }[];
    }> {
        const bets = await this.getPlayBetsForMarket(marketId);

        if (bets.length === 0 || optionsList.length === 0) {
            return { datasets: [] };
        }

        // Sort by time
        const sorted = [...bets].sort(
            (a, b) =>
                new Date(a.placed_at).getTime() -
                new Date(b.placed_at).getTime(),
        );

        // Track cumulative pool per option
        const pools: Record<string, number> = {};
        optionsList.forEach((o) => (pools[o.id] = 0));

        // Start with equal probability
        const datasets = optionsList.map((opt) => ({
            optionId: opt.id,
            label: opt.label,
            data: [
                {
                    value: (1 / optionsList.length) * 100,
                    label: "",
                },
            ],
        }));

        // Process each bet
        sorted.forEach((bet) => {
            if (pools[bet.option_id] !== undefined) {
                pools[bet.option_id] += bet.amount;
            }

            const totalPool = Object.values(pools).reduce((s, v) => s + v, 0);

            if (totalPool > 0) {
                datasets.forEach((ds) => {
                    ds.data.push({
                        value: ((pools[ds.optionId] || 0) / totalPool) * 100,
                        label: "",
                    });
                });
            }
        });

        return { datasets };
    },

    /**
     * Get bet count summary for display
     */
    async getPlayBetSummary(
        userId?: string,
    ): Promise<{ total: number; active: number; resolved: number }> {
        const bets = await this.getPlayBetsWithDetails(userId);
        const active = bets.filter(
            (b) =>
                b.markets?.status === "open" || b.markets?.status === "closed",
        ).length;
        const resolved = bets.filter(
            (b) => b.markets?.status === "resolved",
        ).length;

        return { total: bets.length, active, resolved };
    },
};
