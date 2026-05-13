import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type {
  Market,
  MarketInsert,
  MarketOption,
  MarketOptionInsert,
} from "../types/market";
import { messageService } from "./message.service";

export interface CreateMarketData {
  groupId: string;
  question: string;
  description?: string;
  closesAt?: Date;
  options: string[]; // Array of option labels
  imageUrl?: string;
}

/**
 * Market service
 * Handles market CRUD operations and real-time subscriptions
 */
export const marketService = {
  /**
   * Create a new market with options
   */
  async createMarket(
    data: CreateMarketData,
  ): Promise<{ market: Market | null; error: Error | null }> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { market: null, error: new Error("Not authenticated") };
      }

      // Create market
      const marketInsert: MarketInsert = {
        group_id: data.groupId,
        creator_id: user.id,
        question: data.question,
        description: data.description,
        closes_at: data.closesAt?.toISOString(),
        status: "open",
        image_url: data.imageUrl,
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
      const optionsInsert: MarketOptionInsert[] = data.options.map((label) => ({
        market_id: market.id,
        label,
        total_pool: 0,
      }));

      const { error: optionsError } = await supabase
        .from("options")
        .insert(optionsInsert);

      if (optionsError) {
        // Clean up market if options creation fails
        await supabase.from("markets").delete().eq("id", market.id);
        return { market: null, error: optionsError };
      }

      // Create a message for the new market
      await messageService.sendMessage({
        group_id: data.groupId,
        user_id: user.id,
        message_type: "market",
        market_id: market.id,
        content: `New Market: ${data.question}`,
      });

      // Fetch market with options
      const fullMarket = await this.getMarket(market.id);
      return { market: fullMarket, error: null };
    } catch (error) {
      return { market: null, error: error as Error };
    }
  },

  /**
   * Get a market by ID with its options
   */
  async getMarket(marketId: string): Promise<Market | null> {
    try {
      const { data: market, error } = await supabase
        .from("markets")
        .select("*")
        .eq("id", marketId)
        .single();

      if (error || !market) {
        return null;
      }

      return market as Market;
    } catch (error) {
      console.error("Error fetching market:", error);
      return null;
    }
  },

  /**
   * Get all markets for a group
   */
  async getGroupMarkets(groupId: string): Promise<Market[]> {
    try {
      const { data: markets, error } = await supabase
        .from("markets")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching group markets:", error);
        return [];
      }

      return (markets || []) as Market[];
    } catch (error) {
      console.error("Error fetching group markets:", error);
      return [];
    }
  },

  /**
   * Get options for a market
   */
  async getMarketOptions(marketId: string): Promise<MarketOption[]> {
    try {
      const { data: options, error } = await supabase
        .from("options")
        .select("*")
        .eq("market_id", marketId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching market options:", error);
        return [];
      }

      return (options || []) as MarketOption[];
    } catch (error) {
      console.error("Error fetching market options:", error);
      return [];
    }
  },

  /**
   * Resolve a market (admin only)
   */
  async resolveMarket(
    marketId: string,
    winningOptionId: string,
  ): Promise<{ market: Market | null; error: Error | null }> {
    try {
      const { data, error } = await supabase.rpc("resolve_market", {
        p_market_id: marketId,
        p_winning_option_id: winningOptionId,
      });

      if (error) {
        return { market: null, error };
      }

      const market = await this.getMarket(marketId);
      return { market, error: null };
    } catch (error) {
      return { market: null, error: error as Error };
    }
  },

  /**
   * Subscribe to real-time updates for a market
   */
  subscribeToMarket(
    marketId: string,
    callback: (market: Market) => void,
  ): RealtimeChannel {
    const channel = supabase
      .channel(`market:${marketId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "markets",
          filter: `id=eq.${marketId}`,
        },
        async (payload) => {
          if (
            payload.eventType === "UPDATE" || payload.eventType === "INSERT"
          ) {
            const market = await this.getMarket(marketId);
            if (market) {
              callback(market);
            }
          }
        },
      )
      .subscribe();

    return channel;
  },

  /**
   * Subscribe to real-time updates for market options (pool changes)
   */
  subscribeToMarketOptions(
    marketId: string,
    callback: (options: MarketOption[]) => void,
  ): RealtimeChannel {
    const channel = supabase
      .channel(`market-options:${marketId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "options",
          filter: `market_id=eq.${marketId}`,
        },
        async () => {
          const options = await this.getMarketOptions(marketId);
          callback(options);
        },
      )
      .subscribe();

    return channel;
  },
  /**
   * Subscribe to new markets in a group
   */
  subscribeToGroupMarkets(
    groupId: string,
    callback: () => void,
  ): RealtimeChannel {
    const channel = supabase
      .channel(`group-markets:${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "markets",
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          callback();
        },
      )
      .subscribe();

    return channel;
  },
};
