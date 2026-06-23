/**
 * Optional Sentry bridge for Supabase edge functions.
 * Set SENTRY_DSN in function secrets to enable.
 */

type SentryLike = {
  init: (opts: { dsn: string; environment?: string }) => void;
  captureException: (error: unknown) => void;
};

let sentry: SentryLike | null = null;
let initialized = false;

async function getSentry(): Promise<SentryLike | null> {
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) return null;

  if (!initialized) {
    try {
      const mod = await import("https://deno.land/x/sentry/index.mjs");
      mod.init({ dsn, environment: Deno.env.get("ENVIRONMENT") ?? "production" });
      sentry = mod as SentryLike;
      initialized = true;
    } catch {
      return null;
    }
  }

  return sentry;
}

export async function captureEdgeError(
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  const client = await getSentry();
  if (!client) return;
  if (context) {
    console.error("[sentry-bridge]", context);
  }
  client.captureException(error);
}
