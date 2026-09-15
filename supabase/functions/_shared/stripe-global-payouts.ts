export const STRIPE_API_VERSION = "2026-01-28.preview";

export function recipientBankCapabilities(payoutCountry: string) {
  const country = payoutCountry.toLowerCase();
  if (country === "ec") {
    return { wire: { requested: true } };
  }
  return { local: { requested: true } };
}

export function stripeV2Request(
  stripeSecretKey: string,
  endpoint: string,
  method: string,
  body?: Record<string, unknown>,
  context?: string,
  idempotencyKey?: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${stripeSecretKey}`,
    "Stripe-Version": STRIPE_API_VERSION,
    "Content-Type": "application/json",
  };
  if (context) {
    headers["Stripe-Context"] = context;
  }
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }

  const options: RequestInit = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  return fetch(`https://api.stripe.com${endpoint}`, options);
}
