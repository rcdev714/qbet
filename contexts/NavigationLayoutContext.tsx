import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
    DESKTOP_BREAKPOINT,
    MOBILE_TAB_BAR_HEIGHT,
    SIDEBAR_WIDTH_COLLAPSED,
    SIDEBAR_WIDTH_EXPANDED,
    SIDEBAR_WIDTH_EXPANDED_MAX,
} from "@/constants/layout";

export {
    DESKTOP_BREAKPOINT,
    MOBILE_TAB_BAR_HEIGHT,
    SIDEBAR_WIDTH_COLLAPSED,
    SIDEBAR_WIDTH_EXPANDED,
    SIDEBAR_WIDTH_EXPANDED_MAX
};

const SIDEBAR_COLLAPSED_KEY = "anymarket.sidebarCollapsed";

type NavigationLayoutContextValue = {
  isDesktopWeb: boolean;
  isLayoutReady: boolean;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  sidebarWidth: number | "auto";
};

const NavigationLayoutContext = createContext<NavigationLayoutContextValue | null>(null);

export function NavigationLayoutProvider({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const [hasMounted, setHasMounted] = useState(Platform.OS !== "web");
  const isDesktopWeb = hasMounted && Platform.OS === "web" && width >= DESKTOP_BREAKPOINT;
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);
  const [collapseHydrated, setCollapseHydrated] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(SIDEBAR_COLLAPSED_KEY)
      .then((value) => {
        if (cancelled || value == null) return;
        setSidebarCollapsedState(value === "true");
      })
      .finally(() => {
        if (!cancelled) setCollapseHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!collapseHydrated) return;
    AsyncStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? "true" : "false").catch(() => {});
  }, [collapseHydrated, sidebarCollapsed]);

  useEffect(() => {
    if (!isDesktopWeb) {
      setSidebarCollapsedState(false);
    }
  }, [isDesktopWeb]);

  const setSidebarCollapsed = useCallback<React.Dispatch<React.SetStateAction<boolean>>>((value) => {
    setSidebarCollapsedState(value);
  }, []);

  const sidebarWidth: number | "auto" = sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : "auto";

  const value = useMemo(
    () => ({
      isDesktopWeb,
      isLayoutReady: hasMounted,
      sidebarCollapsed,
      setSidebarCollapsed,
      sidebarWidth,
    }),
    [hasMounted, isDesktopWeb, sidebarCollapsed, setSidebarCollapsed, sidebarWidth],
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
