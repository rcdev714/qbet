import { supabase } from "@/lib/supabase";
import type {
  PendingSettlementPayoutItem,
  PendingSettlementPayoutsSummary,
} from "@/lib/settlement/payout-hold-constants";
import { CONCERN_COMMENT_MIN_LENGTH } from "@/lib/settlement/feedback-constants";
import type {
  AdminTrustScore,
  GroupAdminConsoleGroup,
  MisconductSeverity,
  SettlementFairness,
  SettlementOverrideStatus,
  SettlementReopenEvaluation,
} from "@/types/settlement-governance";

export const settlementGovernanceService = {
  async hasGroupAdminAcknowledgment(): Promise<boolean> {
    const { data, error } = await (supabase as any).rpc(
      "has_group_admin_acknowledgment",
    );
    if (error) {
      console.error("hasGroupAdminAcknowledgment:", error);
      return false;
    }
    return data === true;
  },

  async acceptGroupAdminAcknowledgment(): Promise<{ ok: boolean; error: Error | null }> {
    try {
      const { error } = await (supabase as any).rpc(
        "accept_group_admin_acknowledgment",
      );
      if (error) return { ok: false, error };
      return { ok: true, error: null };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  },

  async getAdminConsoleGroups(): Promise<GroupAdminConsoleGroup[]> {
    const { data, error } = await (supabase as any).rpc(
      "get_groups_administered",
    );
    if (error) {
      console.error("getAdminConsoleGroups:", error);
      return [];
    }
    return (data ?? []) as GroupAdminConsoleGroup[];
  },

  async hasUserRated(marketId: string, userId: string): Promise<boolean> {
    const { data, error } = await (supabase as any)
      .from("group_admin_settlement_ratings")
      .select("id")
      .eq("market_id", marketId)
      .eq("rater_id", userId)
      .maybeSingle();
    if (error) {
      console.error("hasUserRated:", error);
      return false;
    }
    return data != null;
  },

  async getRatedMarketIds(
    marketIds: string[],
    userId: string,
  ): Promise<Set<string>> {
    if (marketIds.length === 0) return new Set();
    const { data, error } = await (supabase as any)
      .from("group_admin_settlement_ratings")
      .select("market_id")
      .eq("rater_id", userId)
      .in("market_id", marketIds);
    if (error) {
      console.error("getRatedMarketIds:", error);
      return new Set();
    }
    return new Set(
      ((data ?? []) as { market_id: string }[]).map((row) => row.market_id),
    );
  },

  async submitAdminRating(input: {
    marketId: string;
    score: number;
    fairness: SettlementFairness;
    comment?: string;
  }): Promise<{ ok: boolean; error: Error | null }> {
    try {
      const comment = input.comment?.trim();
      if (input.fairness === "unclear" || input.score === 3) {
        return {
          ok: false,
          error: new Error("Neutral ratings are not accepted"),
        };
      }
      if (
        (input.fairness === "unfair" || input.score <= 2) &&
        (!comment || comment.length < CONCERN_COMMENT_MIN_LENGTH)
      ) {
        return {
          ok: false,
          error: new Error(
            `Concern ratings require a comment of at least ${CONCERN_COMMENT_MIN_LENGTH} characters`,
          ),
        };
      }

      const { error } = await (supabase as any).rpc(
        "submit_admin_settlement_rating",
        {
          p_market_id: input.marketId,
          p_score: input.score,
          p_fairness: input.fairness,
          p_comment: comment ?? null,
        },
      );
      if (error) return { ok: false, error };
      return { ok: true, error: null };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  },

  async getAdminTrustScore(
    groupId: string,
    adminId: string,
  ): Promise<AdminTrustScore | null> {
    const { data, error } = await (supabase as any).rpc(
      "get_group_admin_trust_score",
      { p_group_id: groupId, p_admin_id: adminId },
    );
    if (error || !data) return null;
    return data as AdminTrustScore;
  },

  async getSettlementOverrideStatus(
    marketId: string,
  ): Promise<SettlementOverrideStatus> {
    const { data, error } = await (supabase as any)
      .from("markets")
      .select("settlement_override_status")
      .eq("id", marketId)
      .maybeSingle();
    if (error || !data) return "none";
    return ((data as { settlement_override_status?: string })
      .settlement_override_status ?? "none") as SettlementOverrideStatus;
  },

  async getReopenEvaluation(
    marketId: string,
  ): Promise<SettlementReopenEvaluation | null> {
    const { data, error } = await (supabase as any)
      .from("settlement_reopen_evaluations")
      .select("*")
      .eq("market_id", marketId)
      .order("evaluated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data as SettlementReopenEvaluation;
  },

  async getPendingPayouts(): Promise<PendingSettlementPayoutsSummary> {
    const { data, error } = await (supabase as any).rpc(
      "get_pending_settlement_payouts",
    );
    if (error || !data) {
      console.error("getPendingPayouts:", error);
      return { total: 0, items: [] };
    }
    const payload = data as {
      total: number | string;
      items: Array<{
        id: string;
        market_id: string;
        market_question: string;
        amount: number | string;
        releases_at: string;
      }> | null;
    };
    const items: PendingSettlementPayoutItem[] = (payload.items ?? []).map(
      (row) => ({
        id: row.id,
        marketId: row.market_id,
        marketQuestion: row.market_question,
        amount: Number(row.amount),
        releasesAt: row.releases_at,
      }),
    );
    return { total: Number(payload.total ?? 0), items };
  },

  async reportAdminMisconduct(input: {
    groupId: string;
    adminId: string;
    marketId?: string;
    severity: MisconductSeverity;
    reason: string;
    details?: string;
    evidenceUrl?: string;
  }): Promise<{ ok: boolean; error: Error | null }> {
    try {
      const { error } = await (supabase as any).rpc("report_admin_misconduct", {
        p_group_id: input.groupId,
        p_admin_id: input.adminId,
        p_market_id: input.marketId ?? null,
        p_severity: input.severity,
        p_reason: input.reason,
        p_details: input.details ?? null,
        p_evidence_url: input.evidenceUrl ?? null,
      });
      if (error) return { ok: false, error };
      return { ok: true, error: null };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  },

  async getGroupDisputes(
    groupId: string,
    status = "pending",
  ): Promise<unknown[]> {
    const { data, error } = await (supabase as any).rpc(
      "get_group_admin_disputes",
      { p_group_id: groupId, p_status: status },
    );
    if (error) {
      console.error("getGroupDisputes:", error);
      return [];
    }
    return data ?? [];
  },

  async getGroupAdminMarkets(
    groupId: string,
    status?: string,
  ): Promise<unknown[]> {
    const { data, error } = await (supabase as any).rpc(
      "get_group_admin_markets",
      { p_group_id: groupId, p_status: status ?? null },
    );
    if (error) {
      console.error("getGroupAdminMarkets:", error);
      return [];
    }
    return data ?? [];
  },
};
