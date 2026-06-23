import type { ComplianceJurisdiction } from "./jurisdiction";

export type { ComplianceJurisdiction };

export type PolicyKind =
  | "terms"
  | "privacy"
  | "risk_disclosure"
  | "market_rules"
  | "aml_kyc"
  | "prohibited_markets";

export type MarketSensitivityTier = "standard" | "restricted" | "prohibited";

export type ComplianceProvider = "stripe_identity" | "stripe_connect" | "moonpay" | "manual";

export type ComplianceStatus =
  | "not_started"
  | "pending"
  | "verified"
  | "requires_review"
  | "rejected"
  | "expired"
  | "provider_restricted"
  | "manual_review";

export const REQUIRED_POLICY_KINDS: PolicyKind[] = [
  "terms",
  "privacy",
  "risk_disclosure",
  "market_rules",
  "aml_kyc",
  "prohibited_markets",
];

/** @deprecated Server reads `prohibited_market_categories` and `market_category_mappings`. */
export const MARKET_CATEGORY_RULES: Record<
  string,
  {
    tier: MarketSensitivityTier;
    publicFeedAllowed: boolean;
    requiresManualReview: boolean;
    reason: string;
  }
> = {
  general_event: {
    tier: "standard",
    publicFeedAllowed: true,
    requiresManualReview: false,
    reason: "Standard future event with objective resolution source.",
  },
  finance: {
    tier: "restricted",
    publicFeedAllowed: false,
    requiresManualReview: true,
    reason: "Finance-adjacent markets need review for investment-contract and consumer-risk concerns.",
  },
  politics: {
    tier: "restricted",
    publicFeedAllowed: false,
    requiresManualReview: true,
    reason: "Political markets can trigger election, manipulation, and public-order concerns.",
  },
  sports: {
    tier: "restricted",
    publicFeedAllowed: false,
    requiresManualReview: true,
    reason: "Sports markets are excluded from the public feed during Ecuador framework development.",
  },
  individual_health: {
    tier: "prohibited",
    publicFeedAllowed: false,
    requiresManualReview: true,
    reason: "Markets on individual health or personal safety are prohibited.",
  },
  violence_or_death: {
    tier: "prohibited",
    publicFeedAllowed: false,
    requiresManualReview: true,
    reason: "Markets that incentivize or speculate on harm, violence, or death are prohibited.",
  },
  national_security: {
    tier: "prohibited",
    publicFeedAllowed: false,
    requiresManualReview: true,
    reason: "National security and conflict markets require legal review before any availability.",
  },
};

/** @deprecated Server reads `compliance_jurisdiction_rules` via `get_compliance_config`. */
export const JURISDICTION_RULES = {
  EC: {
    defaultCurrency: "USD",
    publicSportsMarketsAllowed: false,
    realMoneyRequiresKyc: true,
    cryptoRailsRequireProviderKyc: true,
    requiresTaxAndAmlExport: true,
    note:
      "Ecuador launch posture: no public sports markets, progressive KYC, full ledger exports, and manual review for sensitive categories.",
  },
  US: {
    defaultCurrency: "USD",
    publicSportsMarketsAllowed: true,
    realMoneyRequiresKyc: true,
    cryptoRailsRequireProviderKyc: true,
    requiresTaxAndAmlExport: true,
    note:
      "United States launch posture: standard KYC, ledger exports, and manual review for sensitive categories.",
  },
} as const;

export function normalizeMarketCategory(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "general_event";
}
