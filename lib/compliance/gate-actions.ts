export const GATE_ACTIONS = {
  browse: "browse",
  sandbox: "sandbox",
  createMarket: "create_market",
  livePosition: "live_position",
  stripeDeposit: "stripe_deposit",
  withdrawal: "withdrawal",
  transfer: "transfer",
  moonpayOnramp: "moonpay_onramp",
  moonpayOfframp: "moonpay_offramp",
  resolveMarket: "resolve_market",
} as const;

export type GateAction = (typeof GATE_ACTIONS)[keyof typeof GATE_ACTIONS];

export type GateActionRequirements = {
  action: GateAction;
  requiresPolicyPack: boolean;
  requiresAgeAttestation: boolean;
  requiresKyc: boolean;
  requiresLiveWallet: boolean;
  requiresCryptoRails: boolean;
  requiresMarketApproval: boolean;
  allowsRestrictedUser: boolean;
  description?: string | null;
};
