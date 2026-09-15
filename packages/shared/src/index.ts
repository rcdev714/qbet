/**
 * @anymarkt/shared — RN-free domain helpers for the Vite web app.
 * Expo continues to use root `lib/` / `services/` until native migrates.
 */

export * from "./auth";
export * from "./beta-access";
export * from "./brand";
export * from "./public-env";
export {
  createBrowserSupabaseClient,
  getSupabase,
  hasSupabasePublicEnv,
  supabase,
} from "./supabase";
