import { Platform } from "react-native";

export const THEME_MODE_KEY = "anymarket.themeMode";

export type ThemeMode = "light" | "dark" | "system";

const VALID_MODES = new Set<ThemeMode>(["light", "dark", "system"]);

function parseThemeMode(value: string | null | undefined): ThemeMode | null {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return null;
}

export function readStoredThemeMode(): ThemeMode {
  if (Platform.OS === "web") {
    try {
      if (typeof localStorage !== "undefined") {
        const stored = parseThemeMode(localStorage.getItem(THEME_MODE_KEY));
        if (stored) return stored;
      }
    } catch {
      // Fall through to native default.
    }
  }

  return "dark";
}
