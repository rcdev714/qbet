const appJson = require("./app.json");

/** @param {{ config?: import("@expo/config").ExpoConfig }} ctx */
module.exports = ({ config } = {}) => ({
  ...appJson.expo,
  ...config,
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
  },
});
