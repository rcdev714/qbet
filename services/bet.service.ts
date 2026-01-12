import { supabase } from "../lib/supabase";
import type { Bet } from "../types/market";

export interface PlaceBetData {
  marketId: string;
  optionId: string;
  amount: number;
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
    data: PlaceBetData
  ): Promise<{ bet: Bet | null; error: Error | null }> {
    try {
      const { data: bet, error } = await supabase.rpc("place_bet", {
        p_market_id: data.marketId,
        p_option_id: data.optionId,
        p_amount: data.amount,
      });

      if (error) {
        return { bet: null, error };
      }

      return { bet: bet as Bet, error: null };
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

      return (bets || []) as Bet[];
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
    userId?: string
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

      return (bets || []) as Bet[];
    } catch (error) {
      console.error("Error fetching user market bets:", error);
      return [];
    }
  },
};

