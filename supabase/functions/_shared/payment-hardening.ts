export function parsePositiveIntegerCents(
  value: unknown,
  label = "Amount",
) {
  const amountCents = Number(value);
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error(`${label} must be a positive integer number of cents`);
  }
  return amountCents;
}

export function getOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function buildAllowedOrigins(
  values: Array<string | null | undefined>,
) {
  return new Set(values.map(getOrigin).filter(Boolean) as string[]);
}

export function resolveAllowedUrl(
  candidate: string | null | undefined,
  fallback: string,
  allowedOrigins: Set<string>,
  errorMessage = "Return URL is not allowed",
) {
  if (!candidate) return fallback;

  const origin = getOrigin(candidate);
  if (!origin || !allowedOrigins.has(origin)) {
    throw new Error(errorMessage);
  }

  return candidate;
}

export function isOutboundPaymentFailureEvent(eventType: string) {
  const normalized = eventType.toLowerCase();
  return normalized.includes("outbound_payment") &&
    (
      normalized.includes("fail") ||
      normalized.includes("cancel") ||
      normalized.includes("return") ||
      normalized.includes("revers")
    );
}

export function getReferenceIdFromMetadata(
  metadata?: Record<string, string | undefined | null>,
  fallbackId?: string,
) {
  return metadata?.requestId || metadata?.request_id || fallbackId;
}

export function getStripeObjectId(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "id" in value) {
    return String((value as { id?: string }).id ?? "");
  }
  return null;
}

export function computeCumulativeRefundDelta(
  cumulativeAmount: number,
  previouslyRefunded: number | null | undefined,
) {
  const previous = previouslyRefunded ?? 0;
  if (cumulativeAmount <= previous) {
    return 0;
  }
  return cumulativeAmount - previous;
}
