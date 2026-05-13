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

import { Colors } from "@/constants/theme";

const THEME_MODE_KEY = "anymarket.themeMode";

const lightPalette: ThemeColors = {
    background: Colors.light.background,
    surface: "#FFFFFF",
    primary: Colors.light.tint,
    primarySoft: "#EAF3FF",
    onPrimary: "#FFFFFF",
    text: Colors.light.text,
    textSecondary: "#8E8E93", // keeping some custom values that might not be in constants
    border: "#F0F2F5",
    card: "#FFFFFF",
    error: "#FF3B30",
    success: "#1A7A3E",
    warning: "#A15C00",
    input: "#F2F2F7",
    overlay: "rgba(0, 0, 0, 0.45)",
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
    surface: "#1A2C38",
    primary: Colors.dark.tint,
    primarySoft: "rgba(46, 143, 84, 0.18)",
    onPrimary: "#D1D5DB",
    text: Colors.dark.text,
    textSecondary: "#B1BAD3",
    border: "#2F4553",
    card: "#213743",
    error: "#FF453A",
    success: Colors.dark.tint,
    warning: "#FFB545",
    input: "#0F212E",
    overlay: "rgba(7, 16, 24, 0.72)",
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
    const [mode, setModeState] = React.useState<ThemeMode>("dark");

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
                // Keep the dark default if stored preferences cannot be read.
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
