import { RealtimeChannel } from "@supabase/supabase-js";
import { scanMarketTextForSports } from "../lib/compliance/sports-content";
import { createDebugLogger } from "../lib/debug-log";
import { supabase } from "../lib/supabase";
import { createPostgresChannel } from "../lib/supabase-realtime";
import type {
    Market,
    MarketOption,
    MarketWithStats,
} from "../types/market";
import { messageService } from "./message.service";

const log = createDebugLogger("marketService");

function normalizeMarketOptionLabels(options: string[]): string[] | Error {
  const labels = options.map((label) => label.trim()).filter(Boolean);
  if (labels.length < 2) {
    return new Error("At least two options required");
  }
  return labels;
}

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

      const labels = normalizeMarketOptionLabels(data.options);
      if (labels instanceof Error) {
        return { market: null, error: labels };
      }

      const complianceCategory = "general_event";
      const { data: market, error: createError } = await supabase.rpc(
        "create_market_with_options",
        {
          p_question: data.question,
          p_labels: labels,
          p_group_id: data.groupId,
          p_description: data.description,
          p_closes_at: data.closesAt?.toISOString(),
          p_image_url: data.imageUrl,
          p_status: "open",
          p_is_public: false,
          p_compliance_category: complianceCategory,
          p_resolution_source:
            data.description?.trim() || "Creator-declared source at market creation",
          p_creator_attestation: true,
          p_resolver_type: "creator_source",
          p_metadata: {
            source: "group_market_create",
            sports_scan: scanMarketTextForSports({
              question: data.question,
              description: data.description,
              optionLabels: labels,
              category: complianceCategory,
            }),
          },
        },
      );

      if (createError || !market) {
        return {
          market: null,
          error: createError || new Error("Failed to create market"),
        };
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
        p_evidence_url: null,
        p_evidence_notes: null,
      });

      if (error) {
        return { market: null, error };
      }

      const market = await this.getMarket(marketId);

      try {
        const { data, error: emailError } = await supabase.functions.invoke(
          "dispatch-market-contract-emails",
          { body: { marketId } },
        );
        if (emailError) {
          log.error("resolution contract emails invoke failed", {
            marketId,
            message: emailError.message,
          });
        } else {
          log.info("resolution contract emails dispatched", {
            marketId,
            result: data,
          });
        }
      } catch (emailError) {
        log.error("resolution contract emails failed", {
          marketId,
          error: emailError instanceof Error ? emailError.message : String(emailError),
        });
      }

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
    const channel = createPostgresChannel(`market:${marketId}`)
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
    const channel = createPostgresChannel(`market-options:${marketId}`)
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
   * Get a market with pool statistics (public or group-scoped).
   */
  async getMarketWithStats(marketId: string): Promise<MarketWithStats | null> {
    try {
      const { data: market, error } = await supabase
        .from("markets")
        .select("*, creator:users(username, avatar_url)")
        .eq("id", marketId)
        .single();

      if (error || !market) return null;

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
        const percentage = totalPool > 0 ? (optionTotal / totalPool) * 100 : 0;
        const numOptions = safeOptions.length;
        let yesPrice = totalPool > 0 ? optionTotal / totalPool : 1 / numOptions;
        let noPrice = 1 - yesPrice;
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

      const recentBets = safeBets
        .map((b) => ({
          optionId: b.option_id,
          amount: b.amount,
          placedAt: b.placed_at,
        }))
        .reverse();

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
   * Subscribe to new markets in a group
   */
  subscribeToGroupMarkets(
    groupId: string,
    callback: () => void,
  ): RealtimeChannel {
    const channel = createPostgresChannel(`group-markets:${groupId}`)
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
