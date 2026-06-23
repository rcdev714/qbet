import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
    DESKTOP_BREAKPOINT,
    MOBILE_TAB_BAR_HEIGHT,
    SIDEBAR_WIDTH_COLLAPSED,
    SIDEBAR_WIDTH_EXPANDED,
} from "@/constants/layout";

export {
    DESKTOP_BREAKPOINT,
    MOBILE_TAB_BAR_HEIGHT,
    SIDEBAR_WIDTH_COLLAPSED,
    SIDEBAR_WIDTH_EXPANDED
};

type NavigationLayoutContextValue = {
  isDesktopWeb: boolean;
  isLayoutReady: boolean;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  sidebarWidth: number;
};

const NavigationLayoutContext = createContext<NavigationLayoutContextValue | null>(null);

export function NavigationLayoutProvider({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const [hasMounted, setHasMounted] = useState(Platform.OS !== "web");
  const isDesktopWeb = hasMounted && Platform.OS === "web" && width >= DESKTOP_BREAKPOINT;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!isDesktopWeb) {
      setSidebarCollapsed(false);
    }
  }, [isDesktopWeb]);

  const sidebarWidth = sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;

  const value = useMemo(
    () => ({
      isDesktopWeb,
      isLayoutReady: hasMounted,
      sidebarCollapsed,
      setSidebarCollapsed,
      sidebarWidth,
    }),
    [hasMounted, isDesktopWeb, sidebarCollapsed, sidebarWidth],
  );

  return <NavigationLayoutContext.Provider value={value}>{children}</NavigationLayoutContext.Provider>;
}

export function useNavigationLayout() {
  const context = useContext(NavigationLayoutContext);
  if (!context) {
    throw new Error("useNavigationLayout must be used within NavigationLayoutProvider");
  }
  return context;
}

export function useIsDesktopWebNav() {
  const { width } = useWindowDimensions();
  const [hasMounted, setHasMounted] = useState(Platform.OS !== "web");

  useEffect(() => {
    setHasMounted(true);
  }, []);

  return hasMounted && Platform.OS === "web" && width >= DESKTOP_BREAKPOINT;
}

/** Total bottom tab bar height including safe-area inset (matches tabs layout). */
export function useMobileTabBarHeight() {
  const insets = useSafeAreaInsets();
  return MOBILE_TAB_BAR_HEIGHT + Math.max(insets.bottom, Platform.OS === "web" ? 8 : 0);
}

/** @deprecated Use DESKTOP_BREAKPOINT from constants/layout */
export const PHONE_BREAKPOINT = DESKTOP_BREAKPOINT;
