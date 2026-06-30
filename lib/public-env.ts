import Constants from "expo-constants";

import { APP_URL as BRAND_APP_URL } from "./brand";

type PublicEnvExtra = {
  appUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  stripePublishableKey?: string;
  adminEmail?: string;
  launchJurisdiction?: string;
  betaRequired?: string;
  sentryDsn?: string;
};

function readExtra(): PublicEnvExtra {
  return (Constants.expoConfig?.extra ?? {}) as PublicEnvExtra;
}

export function getPublicEnv() {
  const extra = readExtra();

  return {
    appUrl: (
      extra.appUrl ||
      process.env.EXPO_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      BRAND_APP_URL
    ).replace(/\/$/, ""),
    supabaseUrl:
      extra.supabaseUrl ||
      (__DEV__ ? process.env.EXPO_PUBLIC_SUPABASE_URL || "" : ""),
    supabaseAnonKey:
      extra.supabaseAnonKey ||
      (__DEV__ ? process.env.EXPO_PUBLIC_SUPABASE_KEY || "" : ""),
    stripePublishableKey:
      extra.stripePublishableKey ||
      process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
      "",
    adminEmail:
      extra.adminEmail || process.env.EXPO_PUBLIC_ADMIN_EMAIL || "",
    launchJurisdiction:
      extra.launchJurisdiction ||
      process.env.EXPO_PUBLIC_LAUNCH_JURISDICTION ||
      "EC",
    betaRequired:
      extra.betaRequired ||
      process.env.EXPO_PUBLIC_BETA_REQUIRED ||
      "true",
    debugLogs:
      process.env.EXPO_PUBLIC_DEBUG_LOGS === "true",
    sentryDsn:
      extra.sentryDsn ||
      process.env.EXPO_PUBLIC_SENTRY_DSN ||
      "",
    sentryEnabled:
      Boolean(extra.sentryDsn || process.env.EXPO_PUBLIC_SENTRY_DSN),
    sentryDevEnabled:
      process.env.EXPO_PUBLIC_SENTRY_DEV === "true",
  };
}
