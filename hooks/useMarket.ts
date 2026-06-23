import { useCallback, useEffect, useMemo, useState } from "react";
import { useWalletContext } from "../contexts/WalletContext";
import { teardownChannel } from "../lib/supabase-realtime";
import { betService } from "../services/bet.service";
import { marketService } from "../services/market.service";
import type { Market, MarketOption } from "../types/market";

export function useMarket(marketId: string | null) {
  const [baseMarket, setBaseMarket] = useState<Market | null>(null);
  const [baseOptions, setBaseOptions] = useState<MarketOption[]>([]);
  const [userBets, setUserBets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { isPlayMode, lastBetTime } = useWalletContext();

  const loadMarketData = useCallback(async () => {
    if (!marketId) {
      setLoading(false);
      return;
    }

    try {
      // Fetch all underlying data in parallel
      const [marketData, optionsData, userBetsData] = await Promise.all([
        marketService.getMarket(marketId),
        marketService.getMarketOptions(marketId),
        betService.getUserMarketBets(marketId),
      ]);

      if (marketData) setBaseMarket(marketData);
      setBaseOptions(optionsData || []);
      setUserBets(userBetsData || []);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  // Initial load and refresh on bet placement
  useEffect(() => {
    loadMarketData();
  }, [loadMarketData, lastBetTime]);

  // Subscriptions for real-time live data
  useEffect(() => {
    if (!marketId) return;

    const marketChannel = marketService.subscribeToMarket(
      marketId,
      (updatedMarket) => {
        setBaseMarket(updatedMarket);
      },
    );

    const optionsChannel = marketService.subscribeToMarketOptions(
      marketId,
      (updatedOptions) => {
        setBaseOptions(updatedOptions);
      },
    );

    return () => {
      void teardownChannel(marketChannel);
      void teardownChannel(optionsChannel);
    };
  }, [marketId]);

  // Derived stats (Real-time calculation for toggle and bets)
  const stats = useMemo(() => {
    if (!baseMarket || !baseOptions) {
      return { market: baseMarket, options: baseOptions };
    }

    let displayOptions = baseOptions.map((o) => ({ ...o }));

    // We no longer merge Play Mode bets into the displayed stats.
    // This allows the UI to show Real Market odds even in Play Mode.
    return {
      market: baseMarket,
      options: displayOptions,
    };
  }, [baseMarket, baseOptions]);

  return {
    market: stats.market,
    options: stats.options,
    userBets,
    loading,
    error,
    refresh: loadMarketData,
  };
}

export function useGroupMarkets(groupId: string | null) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { lastBetTime, isPlayMode } = useWalletContext();

  const loadMarkets = useCallback(async () => {
    if (!groupId) {
      setLoading(false);
      return;
    }

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
  }, [groupId]);

  useEffect(() => {
    loadMarkets();
  }, [loadMarkets, lastBetTime, isPlayMode]);

  useEffect(() => {
    if (!groupId) return;

    const channel = marketService.subscribeToGroupMarkets(groupId, () => {
      loadMarkets();
    });

    return () => {
      void teardownChannel(channel);
    };
  }, [groupId, loadMarkets]);

  return {
    markets,
    loading,
    error,
    refresh: loadMarkets,
  };
}
