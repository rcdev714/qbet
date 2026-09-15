export type PayoutSetupState =
  | "ready"
  | "needs_profile"
  | "needs_bank"
  | "pending_review"
  | "needs_connect";

export type PayoutSetupStepState = "done" | "pending" | "current";

export interface PayoutSetupSteps {
  identity: PayoutSetupStepState;
  profile: PayoutSetupStepState;
  bank: PayoutSetupStepState;
}

export interface PayoutConnectStatus {
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
}

export interface PayoutGlobalStatus {
  hasRecipient: boolean;
  hasPayoutMethod: boolean;
}

export interface PayoutDraftRecord {
  bank_code?: string;
  bank_name?: string;
  swift?: string;
  city?: string;
  province?: string;
  first_name?: string;
  last_name?: string;
  address_line1?: string;
  postal_code?: string;
  updated_at?: string;
}

export const PAYOUT_DRAFT_ALLOWED_KEYS = [
  "bank_code",
  "bank_name",
  "swift",
  "city",
  "province",
  "first_name",
  "last_name",
  "address_line1",
  "postal_code",
  "updated_at",
] as const;

export type PayoutDraftAllowedKey = (typeof PAYOUT_DRAFT_ALLOWED_KEYS)[number];

export function validateEcuadorCedula(value: string): boolean {
  return /^\d{10}$/.test(value.replace(/\D/g, ""));
}

export function sanitizePayoutDraft(
  draft: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const key of PAYOUT_DRAFT_ALLOWED_KEYS) {
    if (draft[key] !== undefined && draft[key] !== null) {
      sanitized[key] = draft[key];
    }
  }
  return sanitized;
}

export function parseBankDetailsDraft(
  bankDetails: Record<string, string> | null | undefined,
) {
  if (!bankDetails) return null;
  return {
    bankCode: bankDetails.bank_code,
    bankName: bankDetails.bank_name,
    swift: bankDetails.swift,
    city: bankDetails.city,
    province: bankDetails.province,
    firstName: bankDetails.first_name,
    lastName: bankDetails.last_name,
    addressLine1: bankDetails.address_line1,
    postalCode: bankDetails.postal_code,
  };
}

export function derivePayoutSetupState(input: {
  connect: PayoutConnectStatus;
  globalPayouts: PayoutGlobalStatus;
  hasProfileDraft: boolean;
}): PayoutSetupState {
  const { connect, globalPayouts, hasProfileDraft } = input;

  if (connect.payoutsEnabled && globalPayouts.hasPayoutMethod) {
    return "ready";
  }
  if (connect.detailsSubmitted && !connect.payoutsEnabled) {
    return "pending_review";
  }
  if (hasProfileDraft && !globalPayouts.hasPayoutMethod) {
    return "needs_bank";
  }
  if (!connect.detailsSubmitted && !hasProfileDraft) {
    return "needs_profile";
  }
  if (connect.detailsSubmitted && !globalPayouts.hasPayoutMethod) {
    return "needs_bank";
  }
  return "needs_connect";
}

export function buildPayoutSteps(input: {
  liveWalletReady: boolean;
  onboardingState: PayoutSetupState;
  profileSubmitted: boolean;
  bankLinked: boolean;
}): PayoutSetupSteps {
  const { liveWalletReady, onboardingState, profileSubmitted, bankLinked } = input;

  const identity: PayoutSetupStepState = liveWalletReady ? "done" : "pending";

  let profile: PayoutSetupStepState = "pending";
  if (profileSubmitted || onboardingState === "pending_review") {
    profile = "done";
  } else if (liveWalletReady) {
    profile = "current";
  }

  let bank: PayoutSetupStepState = "pending";
  if (bankLinked || onboardingState === "ready") {
    bank = "done";
  } else if (profileSubmitted && liveWalletReady) {
    bank = "current";
  }

  return { identity, profile, bank };
}

export function buildConnectVerificationBody(details: {
  firstName: string;
  lastName: string;
  dobDay: number;
  dobMonth: number;
  dobYear: number;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  idNumber: string;
  idType?: string;
  externalAccountToken?: string;
}): Record<string, unknown> {
  const isEcuador = details.country.toUpperCase() === "EC";
  const body: Record<string, unknown> = {
    firstName: details.firstName,
    lastName: details.lastName,
    dobDay: details.dobDay,
    dobMonth: details.dobMonth,
    dobYear: details.dobYear,
    addressLine1: details.addressLine1,
    city: details.city,
    state: details.state,
    postalCode: details.postalCode,
    country: details.country,
  };

  if (isEcuador) {
    body.idNumber = details.idNumber;
    body.idType = details.idType ?? "cedula";
  } else {
    body.ssnLast4 = details.idNumber;
    body.idType = "ssn";
  }

  if (details.externalAccountToken) {
    body.externalAccountToken = details.externalAccountToken;
  }

  return body;
}

export function shouldUseDesktopWalletLayout(
  platformOs: string,
  isDesktopWebNav: boolean,
): boolean {
  return platformOs === "web" && isDesktopWebNav;
}

export function shouldShowPayoutSidePanel(input: {
  liveWalletReady: boolean;
  isPlayMode: boolean;
  onboardingState: PayoutSetupState;
}): boolean {
  return (
    input.liveWalletReady &&
    !input.isPlayMode &&
    input.onboardingState !== "ready"
  );
}

export function mapOnboardingLabelKey(state: PayoutSetupState): string {
  if (state === "ready") return "payoutsEnabled";
  if (state === "pending_review") return "verificationReview";
  if (state === "needs_bank") return "needsBank";
  if (state === "needs_profile") return "needsProfile";
  return "setupRequired";
}
