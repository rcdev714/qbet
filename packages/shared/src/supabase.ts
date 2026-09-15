import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getPublicEnv } from "./public-env";

/** Browser localStorage auth adapter — no Expo SecureStore / AsyncStorage. */
const browserStorage = {
  getItem: (key: string) => {
    if (typeof localStorage === "undefined") return Promise.resolve(null);
    return Promise.resolve(localStorage.getItem(key));
  },
  setItem: (key: string, value: string) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, value);
    }
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(key);
    }
    return Promise.resolve();
  },
};

let client: SupabaseClient | null = null;

export function createBrowserSupabaseClient(): SupabaseClient {
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();

  if (!supabaseUrl) {
    throw new Error(
      "Missing VITE_SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL)",
    );
  }
  if (!supabaseAnonKey) {
    throw new Error(
      "Missing VITE_SUPABASE_KEY (or EXPO_PUBLIC_SUPABASE_KEY)",
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: browserStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });
}

/** Lazily initialized singleton for SPA use. */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createBrowserSupabaseClient();
  }
  return client;
}

/** @deprecated Prefer getSupabase() — kept for call-site familiarity. */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabase(), prop, receiver);
  },
});
