import { useCallback, useEffect, useState } from "react";

import {
  dismissSettlementFeedback,
  filterUndismissedMarketIds,
  isSettlementFeedbackDismissed,
} from "@/lib/settlement/feedback-storage";
import { settlementGovernanceService } from "@/services/settlement-governance.service";
import { supabase } from "@/lib/supabase";
import type { Market } from "@/types/market";
import type { SettlementFairness } from "@/types/settlement-governance";

type UseSettlementFeedbackPromptOptions = {
  /** Single market mode (market detail screen). */
  market?: Market | null;
  /** Batch mode (group history tab). */
  markets?: Market[];
  userId?: string;
  /** Whether the prompt scanner should run (e.g. tab visible). */
  enabled?: boolean;
  /** User has at least one bet on the market (market detail). */
  userHasBet?: boolean;
};

export function useSettlementFeedbackPrompt({
  market,
  markets = [],
  userId,
  enabled = true,
  userHasBet = false,
}: UseSettlementFeedbackPromptOptions) {
  const [promptMarket, setPromptMarket] = useState<Market | null>(null);
  const [visible, setVisible] = useState(false);
  const [sessionSuppressedId, setSessionSuppressedId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setSessionSuppressedId(null);
    }
  }, [enabled]);

  const resolveCandidate = useCallback(async () => {
    if (!enabled || !userId) {
      setPromptMarket(null);
      setVisible(false);
      return;
    }

    const candidates: Market[] = market
      ? market.status === "resolved" && market.group_id && userHasBet
        ? [market]
        : []
      : markets.filter((m) => m.status === "resolved" && m.group_id);

    if (candidates.length === 0) {
      setPromptMarket(null);
      setVisible(false);
      return;
    }

    const marketIds = candidates.map((m) => m.id);
    const undismissedIds = await filterUndismissedMarketIds(marketIds);
    if (undismissedIds.length === 0) {
      setPromptMarket(null);
      setVisible(false);
      return;
    }

    let eligibleIds = undismissedIds;

    if (!market) {
      const { data: betRows, error: betError } = await supabase
        .from("bets")
        .select("market_id")
        .eq("user_id", userId)
        .in("market_id", undismissedIds);

      if (betError) {
        console.error("useSettlementFeedbackPrompt bets:", betError);
        setPromptMarket(null);
        setVisible(false);
        return;
      }

      const betMarketIds = new Set((betRows ?? []).map((r) => r.market_id));
      eligibleIds = undismissedIds.filter((id) => betMarketIds.has(id));
    }

    if (eligibleIds.length === 0) {
      setPromptMarket(null);
      setVisible(false);
      return;
    }

    const ratedIds = await settlementGovernanceService.getRatedMarketIds(
      eligibleIds,
      userId,
    );
    const unratedId = eligibleIds.find(
      (id) => !ratedIds.has(id) && id !== sessionSuppressedId,
    );
    if (!unratedId) {
      setPromptMarket(null);
      setVisible(false);
      return;
    }

    const next = candidates.find((m) => m.id === unratedId) ?? null;
    setPromptMarket(next);
    setVisible(next !== null);
  }, [enabled, market, markets, sessionSuppressedId, userHasBet, userId]);

  useEffect(() => {
    void resolveCandidate();
  }, [resolveCandidate]);

  const dismiss = useCallback(async () => {
    if (!promptMarket) {
      setVisible(false);
      return;
    }
    await dismissSettlementFeedback(promptMarket.id);
    setVisible(false);
    setPromptMarket(null);
    void resolveCandidate();
  }, [promptMarket, resolveCandidate]);

  const closeWithoutPersist = useCallback(() => {
    if (promptMarket) {
      setSessionSuppressedId(promptMarket.id);
    }
    setVisible(false);
  }, [promptMarket]);

  const closeAfterSubmit = useCallback(async () => {
    if (promptMarket) {
      await dismissSettlementFeedback(promptMarket.id);
    }
    setVisible(false);
    setPromptMarket(null);
    void resolveCandidate();
  }, [promptMarket, resolveCandidate]);

  const submitRating = useCallback(
    async (input: {
      score: number;
      fairness: SettlementFairness;
      comment?: string;
    }) => {
      if (!promptMarket) {
        return { ok: false, error: new Error("No market selected") };
      }
      const result = await settlementGovernanceService.submitAdminRating({
        marketId: promptMarket.id,
        ...input,
      });
      if (result.ok) {
        await closeAfterSubmit();
      }
      return result;
    },
    [closeAfterSubmit, promptMarket],
  );

  const reopenForMarket = useCallback(
    async (targetMarketId: string) => {
      if (!userId) return;
      const dismissed = await isSettlementFeedbackDismissed(targetMarketId);
      const rated = await settlementGovernanceService.hasUserRated(
        targetMarketId,
        userId,
      );
      if (dismissed || rated) return;

      const found =
        market?.id === targetMarketId
          ? market
          : markets.find((m) => m.id === targetMarketId) ?? null;
      if (!found || found.status !== "resolved") return;

      setPromptMarket(found);
      setVisible(true);
    },
    [market, markets, userId],
  );

  return {
    promptMarket,
    visible,
    dismiss,
    closeWithoutPersist,
    closeAfterSubmit,
    submitRating,
    reopenForMarket,
    refresh: resolveCandidate,
  };
}
