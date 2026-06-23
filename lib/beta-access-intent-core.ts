export type BetaAccessIntentStatus = "submitted" | "approved";

export type BetaAccessIntent = {
  email: string;
  requestId?: string;
  approvalToken?: string;
  status: BetaAccessIntentStatus;
  updatedAt: string;
};

export function parseBetaAccessIntentRaw(raw: string | null): BetaAccessIntent | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as BetaAccessIntent;
    if (!parsed?.email || !parsed?.status) return null;
    if (parsed.status !== "submitted" && parsed.status !== "approved") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function normalizeBetaAccessIntent(
  intent: Omit<BetaAccessIntent, "updatedAt"> & { updatedAt?: string },
): BetaAccessIntent {
  return {
    ...intent,
    email: intent.email.trim().toLowerCase(),
    updatedAt: intent.updatedAt ?? new Date().toISOString(),
  };
}
