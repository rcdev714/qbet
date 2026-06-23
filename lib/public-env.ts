import Constants from "expo-constants";

type PublicEnvExtra = {
  appUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  stripePublishableKey?: string;
  adminEmail?: string;
  launchJurisdiction?: string;
  betaRequired?: string;
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
      "https://anymarket.expo.app"
    ).replace(/\/$/, ""),
    supabaseUrl:
      extra.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || "",
    supabaseAnonKey:
      extra.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_KEY || "",
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
  };
}
