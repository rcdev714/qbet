const appJson = require("./app.json");

/** @param {{ config?: import("@expo/config").ExpoConfig }} ctx */
module.exports = ({ config } = {}) => ({
  ...appJson.expo,
  ...config,
  plugins: [
    ...(appJson.expo.plugins ?? []),
    ...(config?.plugins ?? []),
    [
      "@sentry/react-native/expo",
      {
        organization: "anymarket-5s",
        project: "react-native",
      },
    ],
  ],
  extra: {
    ...appJson.expo.extra,
    ...(config?.extra ?? {}),
    appUrl:
      process.env.EXPO_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      "https://anymarket.expo.app",
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_KEY ?? "",
    stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
    adminEmail: process.env.EXPO_PUBLIC_ADMIN_EMAIL ?? "",
    sentryDsn:
      process.env.EXPO_PUBLIC_SENTRY_DSN ??
      "https://09d1ad9bc1e53d1b81d0a8f47758352a@o4511612891037696.ingest.us.sentry.io/4511612899229696",
  },
});
