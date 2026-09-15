export type SettlementPayoutStatus =
  | "none"
  | "pending_release"
  | "held"
  | "released"
  | "voided";

export type SettlementOverrideStatus =
  | "none"
  | "frozen"
  | "voided"
  | "corrected"
  | "challenged";

export type SettlementFairness = "fair" | "unclear" | "unfair";

export type MisconductSeverity = "feedback" | "report" | "urgent";

export type AdminSettlementRating = {
  id: string;
  market_id: string;
  group_id: string;
  admin_id: string;
  rater_id: string;
  score: number;
  fairness: SettlementFairness;
  comment: string | null;
  created_at: string;
};

export type SettlementReopenEvaluation = {
  id: string;
  market_id: string;
  n_decisive: number;
  p_hat: number;
  wilson_lower: number;
  threshold_used: number;
  bayesian_posterior_unfair: number;
  collusion_excluded_count: number;
  decision: string;
  evaluated_at: string;
};

export type GroupAdminConsoleGroup = {
  group_id: string;
  name: string | null;
  description: string | null;
  avatar_url: string | null;
  member_count: number;
  active_market_count: number;
  pending_dispute_count: number;
  avg_admin_score: number | null;
  platform_override_active: boolean;
  is_discoverable: boolean;
  show_on_profile: boolean;
  created_at: string;
};

export type AdminTrustScore = {
  avg_score: number | null;
  rating_count: number;
  unfair_rate: number | null;
};
