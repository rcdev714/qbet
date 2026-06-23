import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo } from "react-native";

import { ANYMARKET_LOADER_OVERLAY_FILL_MS, AnyMarketLoader } from "@/components/AnyMarketLoader";

type PremiumNavigateOptions = {
  message?: string;
  delayMs?: number;
};

type PremiumNavigationContextValue = {
  navigate: (href: Href | string, options?: PremiumNavigateOptions) => void;
  isNavigating: boolean;
};

export const PremiumNavigationContext = createContext<PremiumNavigationContextValue | null>(null);

/** Fires `router.push` shortly after the overlay fill finishes (one beat). */
const DEFAULT_DELAY_MS = ANYMARKET_LOADER_OVERLAY_FILL_MS + 72;
/** Short tail so the next screen is not blocked by a loader that has already done its job. */
const MIN_DWELL_AFTER_PUSH_MS = 120;
const REDUCED_MOTION_DELAY_MS = 90;
const REDUCED_MOTION_DWELL_AFTER_PUSH_MS = 50;

export function PremiumNavigationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useTranslation("common");
  const [message, setMessage] = useState(() => t("opening"));
  const [isNavigating, setIsNavigating] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => clearPendingTimeout, [clearPendingTimeout]);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener?.("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  const navigate = useCallback(
    (href: Href | string, options?: PremiumNavigateOptions) => {
      clearPendingTimeout();
      const navigationStartedAt = Date.now();
      setMessage(options?.message ?? t("opening"));
      setIsNavigating(true);

      const delayMs = options?.delayMs ?? (reduceMotion ? REDUCED_MOTION_DELAY_MS : DEFAULT_DELAY_MS);

      timeoutRef.current = setTimeout(() => {
        let waitAfterPush = reduceMotion ? REDUCED_MOTION_DWELL_AFTER_PUSH_MS : MIN_DWELL_AFTER_PUSH_MS;
        try {
          router.push(href as any);
        } finally {
          const elapsed = Date.now() - navigationStartedAt;
          const fillTailMs = reduceMotion ? 0 : Math.max(0, ANYMARKET_LOADER_OVERLAY_FILL_MS - elapsed);
          waitAfterPush = Math.max(waitAfterPush, fillTailMs);
        }

        timeoutRef.current = setTimeout(() => {
          setIsNavigating(false);
          timeoutRef.current = null;
        }, waitAfterPush);
      }, delayMs);
    },
    [clearPendingTimeout, reduceMotion, router, t],
  );

  const value = useMemo(
    () => ({
      navigate,
      isNavigating,
    }),
    [isNavigating, navigate],
  );

  return (
    <PremiumNavigationContext.Provider value={value}>
      {children}
      {isNavigating ? <AnyMarketLoader variant="overlay" message={message} /> : null}
    </PremiumNavigationContext.Provider>
  );
}
