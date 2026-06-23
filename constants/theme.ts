/**
 * Design tokens — colors, fonts, elevation, marketing surfaces.
 */

import { Platform, type ViewStyle } from "react-native";

/** Shared brand tokens — use these instead of hardcoded hex values in UI code. */
export const Brand = {
  primary: "#006ADC",
  primarySoft: "#DBEAFE",
  deep: "#1A2F5C",
  onPrimary: "#FFFFFF",
  success: "#22C55E",
  error: "#DC2626",
  warning: "#FBBF24",
  mutedText: "#526173",
} as const;

/** Landing / marketing dark hero derived from Brand */
export const Marketing = {
  heroBackground: "#030712",
  heroBorder: "rgba(255, 255, 255, 0.08)",
  heroSurface: "rgba(255, 255, 255, 0.04)",
  textMuted: "#94A3B8",
  textLink: "#93C5FD",
  accent: Brand.primary,
} as const;

export const Colors = {
  light: {
    text: "#111827",
    background: "#F3F5F8",
    tint: Brand.primary,
    icon: "#4B5563",
    tabIconDefault: "#6B7280",
    tabIconSelected: Brand.primary,
  },
  dark: {
    text: "#E5E7EB",
    background: "#141A22",
    tint: Brand.primary,
    icon: "#9CA3AF",
    tabIconDefault: "#9CA3AF",
    tabIconSelected: Brand.primary,
    accent: Brand.primary,
  },
};

export type ElevationLevel = "none" | "sm" | "md" | "lg";

export const ElevationLight: Record<ElevationLevel, ViewStyle> = {
  none: {},
  sm: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  md: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  lg: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 12,
  },
};

export const ElevationDark: Record<ElevationLevel, ViewStyle> = {
  none: {},
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 3,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 6,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.55,
    shadowRadius: 32,
    elevation: 12,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono:
      "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
