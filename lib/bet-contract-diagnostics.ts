export type BetContractMissingReason =
  | "bet_not_found"
  | "practice_mode"
  | "public_market"
  | "no_group"
  | "unauthorized"
  | "pending_sync"
  | "unknown";

export type BetContractDiagnosis = {
  reason: BetContractMissingReason;
  title: string;
  message: string;
  canRetry: boolean;
  details?: Record<string, unknown>;
};

export async function diagnoseMissingBetContract(
  betId: string,
): Promise<BetContractDiagnosis> {
  const { supabase } = await import("@/lib/supabase");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return {
      reason: "unauthorized",
      title: "Sign in required",
      message: "Sign in to view your wager agreement.",
      canRetry: false,
    };
  }

  const { data: bet, error: betError } = await supabase
    .from("bets")
    .select("id, user_id, market_id, is_play_mode, placed_at")
    .eq("id", betId)
    .maybeSingle();

  if (betError) {
    return {
      reason: "unknown",
      title: "Could not load bet",
      message: betError.message,
      canRetry: true,
      details: { betId, code: betError.code },
    };
  }

  if (!bet) {
    return {
      reason: "bet_not_found",
      title: "Bet not found",
      message: "This bet id does not exist or you do not have access to it.",
      canRetry: false,
      details: { betId },
    };
  }

  if (bet.user_id !== user.id) {
    return {
      reason: "unauthorized",
      title: "Not your bet",
      message: "Wager agreements are only available for your own live positions.",
      canRetry: false,
      details: { betId },
    };
  }

  if (bet.is_play_mode) {
    return {
      reason: "practice_mode",
      title: "Practice mode bet",
      message:
        "Wager agreements are created for live wallet bets in private groups only. Practice positions do not generate contracts.",
      canRetry: false,
      details: { betId, isPlayMode: true },
    };
  }

  const { data: market, error: marketError } = await supabase
    .from("markets")
    .select("id, question, is_public, group_id, status")
    .eq("id", bet.market_id)
    .maybeSingle();

  if (marketError || !market) {
    return {
      reason: "unknown",
      title: "Market unavailable",
      message: marketError?.message ?? "Could not load market details for this bet.",
      canRetry: true,
      details: { betId, marketId: bet.market_id },
    };
  }

  if (market.is_public) {
    return {
      reason: "public_market",
      title: "Public feed bet",
      message:
        "Wallet-tied wager agreements are currently issued for private group markets only.",
      canRetry: false,
      details: { betId, marketId: market.id, isPublic: true },
    };
  }

  if (!market.group_id) {
    return {
      reason: "no_group",
      title: "No group context",
      message: "This bet is not attached to a private group market, so no contract was generated.",
      canRetry: false,
      details: { betId, marketId: market.id },
    };
  }

  return {
    reason: "pending_sync",
    title: "Agreement still syncing",
    message:
      "Your live group bet qualifies for a wager agreement. If it was just placed, wait a moment and tap Retry.",
    canRetry: true,
    details: {
      betId,
      marketId: market.id,
      groupId: market.group_id,
      placedAt: bet.placed_at,
      marketQuestion: market.question,
    },
  };
}

export function formatDiagnosisForDebug(diagnosis: BetContractDiagnosis): string {
  return JSON.stringify(
    {
      reason: diagnosis.reason,
      title: diagnosis.title,
      message: diagnosis.message,
      canRetry: diagnosis.canRetry,
      details: diagnosis.details ?? null,
    },
    null,
    2,
  );
}
