import { Platform } from "react-native";

export const PLAY_MODE_KEY = "@qbet_play_mode";

export function readStoredPlayMode(): boolean {
  if (Platform.OS === "web") {
    try {
      if (typeof localStorage !== "undefined") {
        const stored = localStorage.getItem(PLAY_MODE_KEY);
        if (stored !== null) {
          return stored === "true";
        }
      }
    } catch {
      // Fall through to default.
    }
  }

  return true;
}
