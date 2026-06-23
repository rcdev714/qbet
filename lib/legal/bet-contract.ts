export type BetContractEventType = "placed" | "resolved";

export type BetContractPolicyRef = {
  kind: string;
  version: string;
  title: string;
  url: string | null;
  contentHash: string;
  acceptedAt?: string;
  locale?: string;
};

export type BetContractMember = {
  userId: string;
  username: string;
  role: string;
};

export type BetContractSnapshot = {
  version: string;
  contractNumber: string;
  issuedAt: string;
  bettor: {
    userId: string;
    username: string;
    email: string | null;
  };
  wallet: {
    walletId: string;
    currency: string;
    country: string | null;
    debitAmount: number;
  };
  position: {
    betId: string;
    optionId: string;
    optionLabel: string;
    side: string;
    amount: number;
    placedAt: string;
  };
  market: {
    marketId: string;
    question: string;
    closesAt: string | null;
    creatorUsername: string | null;
    status: string;
  };
  group: {
    groupId: string;
    name: string;
    adminUsername: string | null;
    memberCount: number;
    members: BetContractMember[];
  } | null;
  legal: {
    jurisdiction: string;
    acceptedPolicies: BetContractPolicyRef[];
    policyRoutes: string[];
    disclaimers: string[];
  };
};

export type BetContractResolutionSnapshot = {
  resolvedAt: string;
  winningOptionLabel: string | null;
  outcome: "won" | "lost";
  payoutAmount: number;
  vigRate: number;
};

export type BetContractRecord = {
  id: string;
  bet_id: string;
  wallet_id: string;
  user_id: string;
  market_id: string;
  group_id: string | null;
  contract_number: string;
  jurisdiction: string;
  placed_snapshot: BetContractSnapshot;
  resolved_snapshot: BetContractResolutionSnapshot | null;
  placed_email_sent_at: string | null;
  resolved_email_sent_at: string | null;
  created_at: string;
  resolved_at: string | null;
};

export function parseBetContractSnapshot(raw: unknown): BetContractSnapshot {
  return raw as BetContractSnapshot;
}

export function parseBetContractResolution(raw: unknown): BetContractResolutionSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as BetContractResolutionSnapshot;
}
