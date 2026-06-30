import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { useColorScheme } from "react-native";

import {
    Brand,
    Colors,
    ElevationDark,
    ElevationLight,
    type ElevationLevel,
} from "@/constants/theme";
import { readStoredThemeMode } from "@/lib/theme-preference";
import type { ViewStyle } from "react-native";

export type ThemeMode = "light" | "dark" | "system";

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  primary: string;
  primarySoft: string;
  onPrimary: string;
  text: string;
  textSecondary: string;
  muted: string;
  mutedForeground: string;
  border: string;
  borderSubtle: string;
  ring: string;
  card: string;
  error: string;
  destructive: string;
  success: string;
  warning: string;
  input: string;
  overlay: string;
  marketYes: string;
  marketNo: string;
  radius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    pill: number;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  elevation: (level: ElevationLevel) => ViewStyle;
}

const THEME_MODE_KEY = "anymarket.themeMode";

const sharedRadius = {
  sm: 10,
  md: 14,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

const sharedSpacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
} as const;

function buildPalette(isDark: boolean): ThemeColors {
  const elevationMap = isDark ? ElevationDark : ElevationLight;

  if (isDark) {
    return {
      background: Colors.dark.background,
      surface: "#1C2430",
      surfaceElevated: "#232D3B",
      primary: Colors.dark.tint,
      primarySoft: "rgba(0, 106, 220, 0.16)",
      onPrimary: Brand.onPrimary,
      text: Colors.dark.text,
      textSecondary: "#B0B8C4",
      muted: "#1A222D",
      mutedForeground: "#9CA3AF",
      border: "#303D4D",
      borderSubtle: "rgba(255, 255, 255, 0.06)",
      ring: Brand.primarySoft,
      card: "#232D3B",
      error: "#FF453A",
      destructive: "#FF453A",
      success: Brand.success,
      warning: Brand.warning,
      input: "#1A222D",
      overlay: "rgba(8, 12, 18, 0.72)",
      marketYes: "#2F80ED",
      marketNo: "#E6485D",
      radius: sharedRadius,
      spacing: sharedSpacing,
      elevation: (level) => elevationMap[level],
    };
  }

  return {
    background: Colors.light.background,
    surface: "#FFFFFF",
    surfaceElevated: "#FFFFFF",
    primary: Colors.light.tint,
    primarySoft: Brand.primarySoft,
    onPrimary: Brand.onPrimary,
    text: Colors.light.text,
    textSecondary: "#4B5563",
    muted: "#EEF2F7",
    mutedForeground: Brand.mutedText,
    border: "#D1D9E6",
    borderSubtle: "rgba(15, 23, 42, 0.06)",
    ring: Brand.primarySoft,
    card: "#FFFFFF",
    error: Brand.error,
    destructive: Brand.error,
    success: Brand.success,
    warning: "#B45309",
    input: "#EEF2F7",
    overlay: "rgba(15, 23, 42, 0.5)",
    marketYes: "#2F80ED",
    marketNo: "#E6485D",
    radius: sharedRadius,
    spacing: sharedSpacing,
    elevation: (level) => elevationMap[level],
  };
}

interface ThemeContextType {
  theme: ThemeColors;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  const [mode, setModeState] = React.useState<ThemeMode>("dark");

  useEffect(() => {
    let mounted = true;

    setModeState(readStoredThemeMode());

    AsyncStorage.getItem(THEME_MODE_KEY)
      .then((storedMode) => {
        if (!mounted) return;
        if (storedMode === "light" || storedMode === "dark" || storedMode === "system") {
          setModeState(storedMode);
        }
      })
      .catch(() => {
        // Keep the stored default if preferences cannot be read.
      });

    return () => {
      mounted = false;
    };
  }, []);

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);
    AsyncStorage.setItem(THEME_MODE_KEY, nextMode).catch(() => {
      // The in-memory choice still applies for the current session.
    });
  }, []);

  const isDark = (mode === "system" ? colorScheme : mode) === "dark";
  const theme = useMemo(() => buildPalette(isDark), [isDark]);

  const value = useMemo(
    () => ({
      theme,
      mode,
      setMode,
      isDark,
    }),
    [theme, mode, setMode, isDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
