// @ts-nocheck: shared Deno helper for Supabase Edge Functions.

export type ComplianceAction =
  | "stripe_deposit"
  | "withdrawal"
  | "transfer"
  | "live_position"
  | "moonpay_onramp"
  | "moonpay_offramp"
  | "create_market";

export async function assertComplianceGate(
  supabase: any,
  input: {
    userId: string;
    action: ComplianceAction;
    marketId?: string | null;
    amount?: number | null;
    provider?: string | null;
    cryptoAsset?: string | null;
    cryptoNetwork?: string | null;
  },
) {
  const { data, error } = await supabase.rpc("assert_compliance_gate", {
    p_user_id: input.userId,
    p_action: input.action,
    p_market_id: input.marketId ?? null,
    p_amount: input.amount ?? null,
    p_provider: input.provider ?? null,
    p_crypto_asset: input.cryptoAsset ?? null,
    p_crypto_network: input.cryptoNetwork ?? null,
  });

  if (error) {
    throw new Error(error.message || "Compliance gate denied");
  }

  return data;
}

export async function recordComplianceEvent(
  supabase: any,
  input: {
    userId?: string | null;
    eventType: string;
    action?: string | null;
    decision?: string | null;
    reasonCode?: string | null;
    metadata?: Record<string, unknown>;
    provider?: string | null;
    providerEventId?: string | null;
    marketId?: string | null;
  },
) {
  const { error } = await supabase.rpc("record_compliance_event", {
    p_user_id: input.userId ?? null,
    p_event_type: input.eventType,
    p_action: input.action ?? null,
    p_decision: input.decision ?? null,
    p_reason_code: input.reasonCode ?? null,
    p_metadata: input.metadata ?? {},
    p_provider: input.provider ?? null,
    p_provider_event_id: input.providerEventId ?? null,
    p_market_id: input.marketId ?? null,
  });

  if (error) {
    console.warn("[compliance] Failed to record event", error.message);
  }
}

export function normalizeProviderStatus(provider: string, rawStatus?: string | null) {
  const status = (rawStatus || "").toLowerCase();

  if (provider === "stripe_identity") {
    if (status === "verified") return "verified";
    if (status === "requires_input") return "requires_review";
    if (status === "canceled") return "expired";
    if (status === "processing") return "pending";
  }

  if (provider === "moonpay") {
    if (["completed", "approved", "succeeded"].includes(status)) return "verified";
    if (["failed", "rejected", "blocked"].includes(status)) return "rejected";
    if (["waiting", "pending", "processing"].includes(status)) return "pending";
  }

  if (["verified", "pending", "requires_review", "rejected", "expired", "provider_restricted", "manual_review"].includes(status)) {
    return status;
  }

  return "pending";
}
