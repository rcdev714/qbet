import { useState, useEffect } from "react";
import { marketService } from "../services/market.service";
import { betService } from "../services/bet.service";
import type { Market, MarketOption } from "../types/market";
import type { RealtimeChannel } from "@supabase/supabase-js";

export function useMarket(marketId: string | null) {
  const [market, setMarket] = useState<Market | null>(null);
  const [options, setOptions] = useState<MarketOption[]>([]);
  const [userBets, setUserBets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!marketId) {
      setLoading(false);
      return;
    }

    let marketChannel: RealtimeChannel | null = null;
    let optionsChannel: RealtimeChannel | null = null;

    const loadMarket = async () => {
      try {
        setLoading(true);
        const [marketData, optionsData, userBetsData] = await Promise.all([
          marketService.getMarket(marketId),
          marketService.getMarketOptions(marketId),
          betService.getUserMarketBets(marketId),
        ]);

        if (marketData) {
          setMarket(marketData);
        }
        setOptions(optionsData || []);
        setUserBets(userBetsData || []);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadMarket();

    // Subscribe to real-time updates
    if (marketId) {
      marketChannel = marketService.subscribeToMarket(marketId, (updatedMarket) => {
        setMarket(updatedMarket);
      });

      optionsChannel = marketService.subscribeToMarketOptions(
        marketId,
        (updatedOptions) => {
          setOptions(updatedOptions);
        }
      );
    }

    return () => {
      if (marketChannel) {
        marketChannel.unsubscribe();
      }
      if (optionsChannel) {
        optionsChannel.unsubscribe();
      }
    };
  }, [marketId]);

  return {
    market,
    options,
    userBets,
    loading,
    error,
    refresh: async () => {
      if (!marketId) return;
      // setLoading(true); // Removed to prevent flicker
      const [marketData, optionsData] = await Promise.all([
        marketService.getMarket(marketId),
        marketService.getMarketOptions(marketId),
      ]);
      if (marketData) setMarket(marketData);
      setOptions(optionsData || []);
      // setLoading(false); 
    },
  };
}

export function useGroupMarkets(groupId: string | null) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    const loadMarkets = async () => {
      try {
        setLoading(true);
        const marketsData = await marketService.getGroupMarkets(groupId);
        setMarkets(marketsData);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadMarkets();

    // Subscribe to real-time updates
    const channel = marketService.subscribeToGroupMarkets(groupId, () => {
      loadMarkets();
    });

    return () => {
      channel.unsubscribe();
    };
  }, [groupId]);

  return {
    markets,
    loading,
    error,
    refresh: async () => {
      if (!groupId) return;
      // setLoading(true); // Removed to prevent flicker
      const marketsData = await marketService.getGroupMarkets(groupId);
      setMarkets(marketsData);
      // setLoading(false);
    },
  };
}

