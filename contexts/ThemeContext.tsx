import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";

export type ThemeMode = "light" | "dark" | "system";

export interface ThemeColors {
    background: string;
    surface: string;
    primary: string;
    text: string;
    textSecondary: string;
    border: string;
    card: string;
    error: string;
}

const lightPalette: ThemeColors = {
    background: "#fcfcfcff",
    surface: "#FFFFFF",
    primary: "#007AFF",
    text: "#1A1A1A",
    textSecondary: "#8E8E93",
    border: "#F0F2F5",
    card: "#FFFFFF",
    error: "#FF3B30",
};

const darkPalette: ThemeColors = {
    background: "#000000",
    surface: "#1C1C1E",
    primary: "#007AFF",
    text: "#FFFFFF",
    textSecondary: "#8E8E93",
    border: "#2C2C2E",
    card: "#1C1C1E",
    error: "#FF453A",
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
    const [mode, setMode] = React.useState<ThemeMode>("system");

    const theme = useMemo(() => {
        const isDark = (mode === "system" ? colorScheme : mode) === "dark";
        return isDark ? darkPalette : lightPalette;
    }, [colorScheme, mode]);

    const value = useMemo(() => ({
        theme,
        mode,
        setMode,
        isDark: (mode === "system" ? (colorScheme ?? "light") : mode) === "dark",
    }), [theme, mode, colorScheme]);

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
