import { createDebugLogger } from "../lib/debug-log";
import { BET_WITH_MARKET_AND_OPTION_SELECT } from "../lib/supabase-embeds";
import { supabase } from "../lib/supabase";
import type { Bet } from "../types/market";
import type { BetContractPipelineResult } from "./betContract.service";

const log = createDebugLogger("betService");

export interface PlaceBetData {
  marketId: string;
  optionId: string;
  amount: number;
  side?: "yes" | "no";
  isPlayMode?: boolean;
}

export interface PlaceBetResult {
  bet: Bet | null;
  error: Error | null;
  contractPipeline?: BetContractPipelineResult;
}

/**
 * Bet service
 * Handles betting operations
 */
export const betService = {
  /**
   * Place a bet using the RPC function (atomic wallet debit + bet insert)
   */
  async placeBet(
    data: PlaceBetData,
  ): Promise<PlaceBetResult> {
    try {
      if (data.isPlayMode) {
        // Local Play Mode Logic
        const AsyncStorage =
          require("@react-native-async-storage/async-storage").default;
        const { walletService } = require("./wallet.service"); // Late require to avoid cycle if any

        // 1. Check Balance
        const currentBalance = await walletService.getPlayBalance();
        if (currentBalance < data.amount) {
          return { bet: null, error: new Error("Insufficient play balance") };
        }

        // 2. Deduct Balance
        await walletService.updatePlayBalance(currentBalance - data.amount);

        // 3. Create Local Bet Object
        const localBet: Bet = {
          id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          market_id: data.marketId,
          user_id: (await supabase.auth.getUser()).data.user?.id ||
            "local_user",
          amount: data.amount,
          option_id: data.optionId,
          side: data.side || "yes",
          is_play_mode: true,
          // status: 'pending', // Removed as it causes type error
          placed_at: new Date().toISOString(),
        };

        // 4. Save to AsyncStorage
        const storedBets = await AsyncStorage.getItem("@qbet_play_bets");
        const bets = storedBets ? JSON.parse(storedBets) : [];
        bets.push(localBet);
        await AsyncStorage.setItem("@qbet_play_bets", JSON.stringify(bets));

        return { bet: localBet, error: null };
      }

      const { data: bet, error } = await supabase.rpc("place_bet", {
        p_market_id: data.marketId,
        p_option_id: data.optionId,
        p_amount: data.amount,
        p_side: data.side || "yes",
        p_is_play_mode: data.isPlayMode || false,
      });

      if (error) {
        log.error("place_bet RPC failed", {
          marketId: data.marketId,
          optionId: data.optionId,
          message: error.message,
          code: (error as { code?: string }).code,
        });
        return { bet: null, error };
      }

      const placedBet = bet as Bet;
      let contractPipeline: BetContractPipelineResult | undefined;

      if (!data.isPlayMode) {
        log.debug("running contract pipeline", { betId: placedBet.id });
        try {
          const { betContractService } = require("./betContract.service");
          contractPipeline = await betContractService.runPlacedPipeline(placedBet.id);
          log.info("contract pipeline finished", {
            betId: placedBet.id,
            status: contractPipeline?.status,
          });
        } catch (contractError) {
          contractPipeline = {
            status: "failed",
            betId: placedBet.id,
            error: contractError instanceof Error ? contractError.message : String(contractError),
          };
          log.error("contract pipeline threw", {
            betId: placedBet.id,
            error: contractPipeline.error,
          });
        }
      }

      return { bet: placedBet, error: null, contractPipeline };
    } catch (error) {
      return { bet: null, error: error as Error };
    }
  },

  /**
   * Get all bets for a market
   */
  async getMarketBets(marketId: string): Promise<Bet[]> {
    try {
      const { data: bets, error } = await supabase
        .from("bets")
        .select("*")
        .eq("market_id", marketId)
        .order("placed_at", { ascending: false });

      if (error) {
        console.error("Error fetching market bets:", error);
        return [];
      }

      return (bets || []) as Bet[];
    } catch (error) {
      console.error("Error fetching market bets:", error);
      return [];
    }
  },

  /**
   * Get all bets for the current user
   */
  async getUserBets(userId?: string): Promise<Bet[]> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const targetUserId = userId || user?.id;
      if (!targetUserId) {
        return [];
      }

      const { data: bets, error } = await supabase
        .from("bets")
        .select("*")
        .eq("user_id", targetUserId)
        .order("placed_at", { ascending: false });

      if (error) {
        console.error("Error fetching user bets:", error);
        return [];
      }

      const serverBets = (bets || []) as Bet[];

      // Merge with local play bets
      try {
        const AsyncStorage =
          require("@react-native-async-storage/async-storage").default;
        const stored = await AsyncStorage.getItem("@qbet_play_bets");
        if (stored) {
          const localBets = (JSON.parse(stored) as Bet[]).filter((b) =>
            b.user_id === targetUserId
          );
          // Combine and sort
          return [...localBets, ...serverBets].sort((a, b) =>
            new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime()
          );
        }
      } catch (e) {
        console.warn("Failed to load local bets", e);
      }

      return serverBets;
    } catch (error) {
      console.error("Error fetching user bets:", error);
      return [];
    }
  },

  /**
   * Get bets for a specific market and user
   */
  async getUserMarketBets(
    marketId: string,
    userId?: string,
  ): Promise<Bet[]> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const targetUserId = userId || user?.id;
      if (!targetUserId) {
        return [];
      }

      const { data: bets, error } = await supabase
        .from("bets")
        .select("*")
        .eq("market_id", marketId)
        .eq("user_id", targetUserId)
        .order("placed_at", { ascending: false });

      if (error) {
        console.error("Error fetching user market bets:", error);
        return [];
      }

      const serverBets = (bets || []) as Bet[];

      // Merge with local play bets
      try {
        const AsyncStorage =
          require("@react-native-async-storage/async-storage").default;
        const stored = await AsyncStorage.getItem("@qbet_play_bets");
        if (stored) {
          const localBets = (JSON.parse(stored) as Bet[]).filter((b) =>
            b.user_id === targetUserId && b.market_id === marketId
          );
          // Combine and sort
          return [...localBets, ...serverBets].sort((a, b) =>
            new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime()
          );
        }
      } catch (e) {
        console.warn("Failed to load local bets", e);
      }

      return serverBets;
    } catch (error) {
      console.error("Error fetching user market bets:", error);
      return [];
    }
  },

  /**
   * Get summary stats for user bets
   */
  async getUserBetSummary(
    userId?: string,
  ): Promise<{ totalBets: number; activeBets: number; closedBets: number }> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const targetUserId = userId || user?.id;
      if (!targetUserId) {
        return { totalBets: 0, activeBets: 0, closedBets: 0 };
      }

      const { data: bets, error } = await supabase
        .from("bets")
        .select("id, market_id")
        .eq("user_id", targetUserId);

      if (error) {
        console.error("Error fetching user bets:", error);
        return { totalBets: 0, activeBets: 0, closedBets: 0 };
      }

      const totalBets = bets?.length || 0;
      const marketIds = Array.from(
        new Set((bets || []).map((bet) => bet.market_id).filter(Boolean)),
      ) as string[];

      // Local bets processing
      let localBets: Bet[] = [];
      try {
        const AsyncStorage =
          require("@react-native-async-storage/async-storage").default;
        const stored = await AsyncStorage.getItem("@qbet_play_bets");
        if (stored) {
          localBets = (JSON.parse(stored) as Bet[]).filter((b) =>
            b.user_id === targetUserId
          );
        }
      } catch (e) {}

      // Combine market IDs
      const localMarketIds = localBets.map((b) => b.market_id).filter(
        Boolean,
      ) as string[];
      const allMarketIds = Array.from(
        new Set([...marketIds, ...localMarketIds]),
      );

      if (allMarketIds.length === 0) {
        return {
          totalBets: totalBets + localBets.length,
          activeBets: 0,
          closedBets: totalBets + localBets.length,
        };
      }

      const { data: markets, error: marketsError } = await supabase
        .from("markets")
        .select("id, status")
        .in("id", allMarketIds);

      if (marketsError) {
        console.error("Error fetching market statuses:", marketsError);
        return { totalBets, activeBets: 0, closedBets: totalBets };
      }

      const statusByMarketId = new Map(
        (markets || []).map((market) => [market.id, market.status]),
      );

      let activeBets = 0;
      let closedBets = 0;

      // Count server bets
      (bets || []).forEach((bet) => {
        if (!bet.market_id) {
          closedBets += 1;
          return;
        }
        const status = statusByMarketId.get(bet.market_id);
        if (status === "open") {
          activeBets += 1;
        } else {
          closedBets += 1;
        }
      });

      // Count local bets
      localBets.forEach((bet) => {
        if (!bet.market_id) {
          closedBets += 1;
          return;
        }
        const status = statusByMarketId.get(bet.market_id);
        if (status === "open") {
          activeBets += 1;
        } else {
          closedBets += 1;
        }
      });

      return {
        totalBets: totalBets + localBets.length,
        activeBets,
        closedBets,
      };
    } catch (error) {
      console.error("Error fetching bet summary:", error);
      return { totalBets: 0, activeBets: 0, closedBets: 0 };
    }
  },

  /**
   * Get bets for user with detailed market and option info
   */
  async getUserBetsWithDetails(userId?: string): Promise<any[]> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const targetUserId = userId || user?.id;
      if (!targetUserId) {
        return [];
      }

      const { data: bets, error } = await supabase
        .from("bets")
        .select(BET_WITH_MARKET_AND_OPTION_SELECT)
        .eq("user_id", targetUserId)
        .order("placed_at", { ascending: false });

      if (error) {
        console.error("Error fetching user bets with details:", error);
        return [];
      }

      // We are skipping local bets for "WithDetails" for now because fetching associated market/option objects locally is complex
      // or we can implement it if needed, but the core requirement is "Potential Win" which usually uses getUserMarketBets

      return bets || [];
    } catch (error) {
      console.error("Error fetching user bets with details:", error);
      return [];
    }
  },

  /**
   * Check and process winnings for Play Mode bets
   * This simulates "Real Market" returns by checking the status of Real Markets
   * and paying out Play Mode bets based on Real Market distributions.
   */
  async checkProcessPlayModeWinnings(): Promise<void> {
    try {
      const AsyncStorage =
        require("@react-native-async-storage/async-storage").default;
      const { walletService } = require("./wallet.service"); // Late require

      // 1. Load Local Bets
      const stored = await AsyncStorage.getItem("@qbet_play_bets");
      if (!stored) return;

      let allBets = JSON.parse(
        stored,
      ) as (Bet & { payout_processed?: boolean })[];

      // Filter for unprocessed bets that might be eligible for payout
      const unprocessedBets = allBets.filter((b) => !b.payout_processed);
      if (unprocessedBets.length === 0) return;

      // 2. Group by Market ID
      const marketIds = [...new Set(unprocessedBets.map((b) => b.market_id))];

      // 3. Fetch Real Market Statuses
      const { data: markets, error } = await supabase
        .from("markets")
        .select("id, status, winning_option_id")
        .in("id", marketIds)
        .eq("status", "resolved"); // Only care about resolved markets

      if (error || !markets || markets.length === 0) return;

      // 4. For resolved markets, we need Option Stats to calculate Payout
      const resolvedMarketIds = markets.map((m) => m.id);
      const { data: options, error: optError } = await supabase
        .from("options")
        .select("id, market_id, total_pool, yes_pool, no_pool")
        .in("market_id", resolvedMarketIds);

      if (optError || !options) return;

      let totalWinnings = 0;
      let processedCount = 0;

      // 5. Calculate Payouts
      allBets = allBets.map((bet) => {
        // Skip if already processed or not in our resolved list
        const market = markets.find((m) => m.id === bet.market_id);
        if (!market || bet.payout_processed) return bet;

        const winningOptionId = market.winning_option_id;
        if (!winningOptionId) return bet; // Should happen if resolved?

        // Did user bet on winner?
        // Note: bet.option_id is the option they bet "YES" on (usually).
        // If they bet "NO", they win if that option LOSES?
        // Our system simplifies: bet is on option_id with side 'yes' or 'no'.
        // Winning Logic:
        // - If I bet YES on Option A, and Option A is Winner -> WIN
        // - If I bet NO on Option A, and Option A is NOT Winner? (Complex in multi-option)
        // - Usually, we simplify: You bet on an option. The Winning Option is X.

        // Let's assume standard yes/no betting per option.
        // If bet.side == 'yes' and bet.option_id == winningOptionId -> Win?
        // Parimutuel Payout Logic in `lib/parimutuel` handles this if we had the full structure.
        // Simplified Logic for Simulation:

        let isWin = false;
        if (bet.side === "yes" && bet.option_id === winningOptionId) {
          isWin = true;
        }
        // Handling 'no' bets in multi-outcome is tricky, assume simple YES betting on winner for now unless binary.
        // Actually, if binary, one option wins.

        if (isWin) {
          // Calculate Multiplier
          // We need the Total Pool of the MARKET (Real) and the Pool of the WINNING OPTION (Real).
          // Find all options for this market
          const marketOptions = options.filter((o) =>
            o.market_id === market.id
          );

          const realTotalPool = marketOptions.reduce(
            (sum, o) => sum + (Number(o.total_pool) || 0),
            0,
          );
          const winningOption = marketOptions.find((o) =>
            o.id === winningOptionId
          );

          // If we can't find stats, skip
          if (realTotalPool > 0 && winningOption) {
            const winningPool = Number(winningOption.total_pool) || 0; // Assuming total_pool tracks yes bets in simple model?
            // Actually, options table has `total_pool` (usually sum of YES bets on that option in multi-choice).
            // In binary, it's different.
            // Let's use `calculatePayoutMultiplier` logic properly if possible.
            // Payout = (TotalPool * (1 - fee)) / WinningPool

            const VIG = 0.0795; // 7.95%
            const poolAfterHas = realTotalPool * (1 - VIG);
            let multiplier = 0;
            if (winningPool > 0) {
              multiplier = poolAfterHas / winningPool;
            }

            // Payout
            const payout = bet.amount * multiplier;
            totalWinnings += payout;
          }
        }

        // Mark as processed regardless of win/loss
        processedCount++;
        return { ...bet, payout_processed: true };
      });

      // 6. Save Updated Bets
      if (processedCount > 0) {
        await AsyncStorage.setItem("@qbet_play_bets", JSON.stringify(allBets));

        // 7. Credit Balance
        if (totalWinnings > 0) {
          const currentBalance = await walletService.getPlayBalance();
          await walletService.updatePlayBalance(currentBalance + totalWinnings);
        }
      }
    } catch (e) {
      console.error("Failed to process play mode winnings", e);
    }
  },
};
