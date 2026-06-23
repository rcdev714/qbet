/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from "react-native";

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

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
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
