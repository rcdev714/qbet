import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

import type { Database } from "../types/database";
import { getPublicEnv } from "./public-env";

// Expo static export (EAS deploy) renders on Node 20, which lacks native WebSocket.
if (typeof window === "undefined" && typeof globalThis.WebSocket === "undefined") {
  const WebSocketImpl = require("ws") as typeof import("ws");
  (globalThis as typeof globalThis & { WebSocket: typeof WebSocket }).WebSocket =
    WebSocketImpl as unknown as typeof WebSocket;
}

const { supabaseUrl, supabaseAnonKey } = getPublicEnv();

if (!supabaseUrl) {
  throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL");
}

if (!supabaseAnonKey) {
  throw new Error("Missing EXPO_PUBLIC_SUPABASE_KEY");
}

// Custom storage adapter that supports web and mobile
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    if (Platform.OS === "web") {
      if (typeof localStorage === "undefined") return Promise.resolve(null);
      return Promise.resolve(localStorage.getItem(key));
    }
    // Use AsyncStorage for mobile instead of SecureStore to avoid version mismatch issues
    // or if SecureStore is causing crashes.
    return AsyncStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, value);
      }
      return Promise.resolve();
    }
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(key);
      }
      return Promise.resolve();
    }
    return AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});
