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

const STORAGE_KEY = "@qbet/beta-access-intent";

async function readRaw(): Promise<string | null> {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

async function writeRaw(value: string): Promise<void> {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, value);
  }
}

export async function getBetaAccessIntent(): Promise<BetaAccessIntent | null> {
  const raw = await readRaw();
  return parseBetaAccessIntentRaw(raw);
}

export async function saveBetaAccessIntent(
  intent: Omit<BetaAccessIntent, "updatedAt"> & { updatedAt?: string },
): Promise<void> {
  const payload = normalizeBetaAccessIntent(intent);
  await writeRaw(JSON.stringify(payload));
}

export async function clearBetaAccessIntent(): Promise<void> {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export async function saveSubmittedIntent(email: string, requestId?: string): Promise<void> {
  await saveBetaAccessIntent({
    email,
    requestId,
    status: "submitted",
  });
}

export async function saveApprovedIntent(input: {
  email: string;
  requestId?: string;
  approvalToken?: string;
}): Promise<void> {
  await saveBetaAccessIntent({
    email: input.email,
    requestId: input.requestId,
    approvalToken: input.approvalToken,
    status: "approved",
  });
}
