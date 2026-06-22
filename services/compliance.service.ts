import type { ComplianceProvider, ComplianceStatus, PolicyKind } from "../lib/compliance/policy";
import { supabase } from "../lib/supabase";

export interface PolicyVersion {
  id: string;
  kind: PolicyKind;
  version: string;
  title: string;
  url: string | null;
  content_hash: string;
  effective_at: string;
}

export interface ComplianceProfile {
  user_id: string;
  kyc_provider: ComplianceProvider | string;
  kyc_status: ComplianceStatus;
  jurisdiction: string;
  age_verified: boolean;
  live_wallet_enabled: boolean;
  crypto_rails_enabled: boolean;
  risk_tier: "standard" | "elevated" | "restricted" | "prohibited";
  review_status: "not_started" | "pending" | "approved" | "rejected" | "frozen";
  restriction_reason?: string | null;
}

export interface MoonPaySessionInput {
  direction: "onramp" | "offramp";
  fiatAmount?: number;
  fiatCurrency?: string;
  cryptoCurrency?: string;
  network?: string;
  walletAddress?: string;
  refundWalletAddress?: string;
}

export const complianceService = {
  async getRequiredPolicies(): Promise<PolicyVersion[]> {
    const { data, error } = await (supabase as any)
      .from("policy_versions")
      .select("*")
      .eq("is_required", true)
      .is("retired_at", null)
      .lte("effective_at", new Date().toISOString())
      .order("kind")
      .order("effective_at", { ascending: false });

    if (error) throw error;

    const latestByKind = new Map<string, PolicyVersion>();
    (data || []).forEach((policy: PolicyVersion) => {
      if (!latestByKind.has(policy.kind)) {
        latestByKind.set(policy.kind, policy as PolicyVersion);
      }
    });
    return Array.from(latestByKind.values());
  },

  async acceptCurrentPolicies(source: string = "signup") {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) throw new Error("Not authenticated");

    const policies = await this.getRequiredPolicies();
    if (policies.length === 0) return;

    const rows = policies.map((policy) => ({
      user_id: user.id,
      policy_version_id: policy.id,
      source,
      locale: typeof navigator !== "undefined" ? navigator.language : undefined,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      app_version: "1.0.0",
    }));

    const { error } = await (supabase as any)
      .from("user_policy_acceptances")
      .upsert(rows, { onConflict: "user_id,policy_version_id" });

    if (error) throw error;
  },

  async getProfile(userId?: string): Promise<ComplianceProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    const targetUserId = userId || user?.id;
    if (!targetUserId) return null;

    const { data, error } = await (supabase as any)
      .from("user_compliance_profiles")
      .select("*")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (error) throw error;
    return data as ComplianceProfile | null;
  },

  async startStripeIdentity() {
    const { data, error } = await supabase.functions.invoke("create-identity-session", {
      body: {},
    });

    if (error) throw error;
    return data as { id: string; url?: string; clientSecret?: string; status: string };
  },

  async startMoonPaySession(input: MoonPaySessionInput) {
    const { data, error } = await supabase.functions.invoke("create-moonpay-session", {
      body: input,
    });

    if (error) throw error;
    return data as { url: string; direction: string; externalTransactionId?: string; signed: boolean; note?: string };
  },

  async getMarketComplianceReview(marketId: string) {
    const { data, error } = await (supabase as any)
      .from("market_compliance_reviews")
      .select("*")
      .eq("market_id", marketId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getComplianceEvents(limit = 100) {
    const { data, error } = await (supabase as any)
      .from("compliance_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  async getLedgerExport({
    startDate,
    endDate,
    userId,
  }: {
    startDate?: string;
    endDate?: string;
    userId?: string;
  } = {}) {
    let query = (supabase as any)
      .from("accounting_ledger_entries")
      .select("*")
      .order("created_at", { ascending: false });

    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) query = query.lte("created_at", endDate);
    if (userId) query = query.eq("user_id", userId);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getCryptoTransactions(limit = 100) {
    const { data, error } = await (supabase as any)
      .from("crypto_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  async getRegulatoryReportPeriods(jurisdiction = "EC") {
    const { data, error } = await (supabase as any)
      .from("regulatory_report_periods")
      .select("*")
      .eq("jurisdiction", jurisdiction)
      .order("period_start", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async prepareRegulatoryReportPeriod({
    jurisdiction = "EC",
    periodStart,
    periodEnd,
  }: {
    jurisdiction?: string;
    periodStart: string;
    periodEnd: string;
  }) {
    const { data, error } = await (supabase as any).rpc("prepare_regulatory_report_period", {
      p_jurisdiction: jurisdiction,
      p_period_start: periodStart,
      p_period_end: periodEnd,
    });

    if (error) throw error;
    return data;
  },
};
