import { APP_URL as BRAND_APP_URL } from "./brand";

/**
 * Reads client-safe public env for Vite (VITE_*) with EXPO_PUBLIC_* fallback
 * so one `.env` can feed both Expo and the Vite web app during cutover.
 */
function read(name: string, ...fallbacks: string[]): string {
  const viteKey = `VITE_${name}`;
  const expoKey = `EXPO_PUBLIC_${name}`;

  const metaEnv = import.meta.env;
  const fromMeta = metaEnv[viteKey] ?? metaEnv[expoKey];
  if (fromMeta) return fromMeta;

  if (typeof process !== "undefined" && process.env) {
    for (const key of [viteKey, expoKey, ...fallbacks]) {
      const value = process.env[key];
      if (value) return value;
    }
  }

  return "";
}

export function getPublicEnv() {
  const appUrl = (
    read("APP_URL", "APP_URL") || BRAND_APP_URL
  ).replace(/\/$/, "");

  return {
    appUrl,
    supabaseUrl: read("SUPABASE_URL"),
    supabaseAnonKey: read("SUPABASE_KEY", "SUPABASE_ANON_KEY"),
    stripePublishableKey: read("STRIPE_PUBLISHABLE_KEY"),
    adminEmail: read("ADMIN_EMAIL"),
    launchJurisdiction: read("LAUNCH_JURISDICTION") || "EC",
    betaRequired: read("BETA_REQUIRED") || "true",
    debugLogs: read("DEBUG_LOGS") === "true",
    sentryDsn: read("SENTRY_DSN"),
    sentryEnabled: Boolean(read("SENTRY_DSN")),
    sentryDevEnabled: read("SENTRY_DEV") === "true",
  };
}
