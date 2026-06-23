import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { useColorScheme } from "react-native";

export type ThemeMode = "light" | "dark" | "system";

export interface ThemeColors {
    background: string;
    surface: string;
    primary: string;
    primarySoft: string;
    onPrimary: string;
    text: string;
    textSecondary: string;
    border: string;
    card: string;
    error: string;
    success: string;
    warning: string;
    input: string;
    overlay: string;
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
}

import { Brand, Colors } from "@/constants/theme";

const THEME_MODE_KEY = "anymarket.themeMode";

const lightPalette: ThemeColors = {
    background: Colors.light.background,
    surface: "#FFFFFF",
    primary: Colors.light.tint,
    primarySoft: Brand.primarySoft,
    onPrimary: "#FFFFFF",
    text: Colors.light.text,
    textSecondary: "#4B5563",
    border: "#D1D9E6",
    card: "#FFFFFF",
    error: "#DC2626",
    success: Brand.success,
    warning: "#B45309",
    input: "#EEF2F7",
    overlay: "rgba(15, 23, 42, 0.5)",
    radius: {
        sm: 10,
        md: 14,
        lg: 16,
        xl: 24,
        pill: 999,
    },
    spacing: {
        xs: 6,
        sm: 10,
        md: 14,
        lg: 20,
        xl: 28,
    },
};

const darkPalette: ThemeColors = {
    background: Colors.dark.background,
    surface: "#1C2430",
    primary: Colors.dark.tint,
    primarySoft: "rgba(0, 106, 220, 0.16)",
    onPrimary: "#FFFFFF",
    text: Colors.dark.text,
    textSecondary: "#9CA3AF",
    border: "#303D4D",
    card: "#232D3B",
    error: "#FF453A",
    success: Brand.success,
    warning: "#FBBF24",
    input: "#1A222D",
    overlay: "rgba(8, 12, 18, 0.72)",
    radius: {
        sm: 10,
        md: 14,
        lg: 16,
        xl: 24,
        pill: 999,
    },
    spacing: {
        xs: 6,
        sm: 10,
        md: 14,
        lg: 20,
        xl: 28,
    },
};

interface ThemeContextType {
    theme: ThemeColors;
    mode: ThemeMode;
    setMode: (mode: ThemeMode) => void;
    isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const colorScheme = useColorScheme();
    const [mode, setModeState] = React.useState<ThemeMode>("light");

    useEffect(() => {
        let mounted = true;

        AsyncStorage.getItem(THEME_MODE_KEY)
            .then((storedMode) => {
                if (!mounted) return;
                if (storedMode === "light" || storedMode === "dark" || storedMode === "system") {
                    setModeState(storedMode);
                }
            })
            .catch(() => {
                // Keep the light default if stored preferences cannot be read.
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

    const theme = useMemo(() => {
        const isDark = (mode === "system" ? colorScheme : mode) === "dark";
        return isDark ? darkPalette : lightPalette;
    }, [colorScheme, mode]);

    const value = useMemo(() => ({
        theme,
        mode,
        setMode,
        isDark: (mode === "system" ? (colorScheme ?? "light") : mode) === "dark",
    }), [theme, mode, setMode, colorScheme]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
}
