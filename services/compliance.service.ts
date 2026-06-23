import type { ComplianceJurisdiction } from "@/lib/compliance/jurisdiction";
import { DEFAULT_JURISDICTION } from "@/lib/compliance/jurisdiction";
import type { PolicyKind } from "@/lib/compliance/policy";
import { supabase } from "@/lib/supabase";

export interface PolicyVersion {
  id: string;
  kind: PolicyKind;
  version: string;
  title: string;
  url: string | null;
  content_hash: string;
  effective_at: string;
  jurisdiction?: string;
}

export interface ComplianceProfile {
  user_id: string;
  kyc_provider: string;
  kyc_status: string;
  jurisdiction: string;
  age_verified: boolean;
  age_attested_at?: string | null;
  live_wallet_enabled: boolean;
  crypto_rails_enabled: boolean;
  risk_tier: "standard" | "elevated" | "restricted" | "prohibited";
  review_status: "not_started" | "pending" | "approved" | "rejected" | "frozen";
  restriction_reason?: string | null;
}

export interface UserResidence {
  country_of_residence: string | null;
  phone_e164: string | null;
  phone_country_code: string | null;
  residence_set_at: string | null;
  jurisdiction: ComplianceJurisdiction;
  country_name?: string | null;
}

export interface SupportedCountryRow {
  country_code: string;
  name: string;
  dial_code: string;
  default_jurisdiction: ComplianceJurisdiction;
  primary_ui_locale?: "en" | "es";
  is_launch_enabled: boolean;
  sort_order: number;
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

async function resolveUserJurisdiction(userId?: string): Promise<ComplianceJurisdiction> {
  const { data: { user } } = await supabase.auth.getUser();
  const targetUserId = userId || user?.id;
  if (!targetUserId) return DEFAULT_JURISDICTION;

  const { data, error } = await (supabase as any).rpc("get_user_compliance_jurisdiction", {
    p_user_id: targetUserId,
  });
  if (error || !data) return DEFAULT_JURISDICTION;
  return data === "EC" ? "EC" : "US";
}

export const complianceService = {
  async getSupportedCountries(): Promise<SupportedCountryRow[]> {
    const { data, error } = await (supabase as any)
      .from("supported_residence_countries")
      .select("*")
      .eq("is_launch_enabled", true)
      .order("sort_order")
      .order("name");

    if (error) throw error;
    return (data || []) as SupportedCountryRow[];
  },

  async getUserResidence(userId?: string): Promise<UserResidence | null> {
    const { data: { user } } = await supabase.auth.getUser();
    const targetUserId = userId || user?.id;
    if (!targetUserId) return null;

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("country_of_residence, phone_e164, phone_country_code, residence_set_at")
      .eq("id", targetUserId)
      .maybeSingle();

    if (userError) throw userError;
    if (!userRow) return null;

    const jurisdiction = await resolveUserJurisdiction(targetUserId);

    let country_name: string | null = null;
    if (userRow.country_of_residence) {
      const { data: countryRow } = await (supabase as any)
        .from("supported_residence_countries")
        .select("name")
        .eq("country_code", userRow.country_of_residence)
        .maybeSingle();
      country_name = countryRow?.name ?? userRow.country_of_residence;
    }

    return {
      ...userRow,
      jurisdiction,
      country_name,
    };
  },

  async hasSetResidence(userId?: string): Promise<boolean> {
    const residence = await this.getUserResidence(userId);
    return Boolean(residence?.country_of_residence);
  },

  async setUserResidence(input: {
    country: string;
    phoneE164?: string | null;
  }): Promise<{ jurisdiction: ComplianceJurisdiction; country: string }> {
    const { data, error } = await (supabase as any).rpc("set_user_residence", {
      p_country: input.country,
      p_phone_e164: input.phoneE164 ?? null,
    });

    if (error) {
      if (error.message?.includes("residence_locked")) {
        throw new Error("Country of residence is already set and cannot be changed in the app.");
      }
      throw error;
    }

    const result = data as { jurisdiction: ComplianceJurisdiction; country: string };
    return result;
  },

  async updateUserPhone(phoneE164: string | null): Promise<void> {
    const { error } = await (supabase as any).rpc("update_user_phone", {
      p_phone_e164: phoneE164,
    });
    if (error) throw error;
  },

  async recordAgeAttestation(): Promise<void> {
    const { error } = await (supabase as any).rpc("record_age_attestation");
    if (error) throw error;
  },

  async hasAgeAttestation(userId?: string): Promise<boolean> {
    const profile = await this.getProfile(userId);
    return Boolean(profile?.age_attested_at);
  },

  async isLiveWalletReady(userId?: string): Promise<boolean> {
    const profile = await this.getProfile(userId);
    return profile?.kyc_status === "verified" && profile?.live_wallet_enabled === true;
  },

  async hasBetaAccess(userId?: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    const targetUserId = userId || user?.id;
    if (!targetUserId) return false;

    const { data, error } = await (supabase as any).rpc("user_has_beta_access", {
      p_user_id: targetUserId,
    });
    if (error) return false;
    return data === true;
  },

  async getRequiredPolicies(jurisdiction?: ComplianceJurisdiction): Promise<PolicyVersion[]> {
    const targetJurisdiction = jurisdiction || (await resolveUserJurisdiction());

    const { data, error } = await (supabase as any)
      .from("policy_versions")
      .select("*")
      .eq("is_required", true)
      .eq("jurisdiction", targetJurisdiction)
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

  async acceptCurrentPolicies(source: string = "signup", jurisdiction?: ComplianceJurisdiction) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) throw new Error("Not authenticated");

    const policies = await this.getRequiredPolicies(jurisdiction);
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

  async hasAcceptedCurrentPolicies(userId?: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    const targetUserId = userId || user?.id;
    if (!targetUserId) return false;

    const { data, error } = await supabase.rpc("has_current_policy_acceptances", {
      p_user_id: targetUserId,
    });

    if (error) throw error;
    return data === true;
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
