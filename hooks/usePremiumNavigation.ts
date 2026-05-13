import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useCallback, useContext } from "react";

import { PremiumNavigationContext } from "@/components/PremiumNavigationProvider";

type PremiumNavigateOptions = {
  message?: string;
  delayMs?: number;
};

export function usePremiumNavigation() {
  const context = useContext(PremiumNavigationContext);
  const router = useRouter();

  const navigate = useCallback(
    (href: Href | string, options?: PremiumNavigateOptions) => {
      if (context) {
        context.navigate(href, options);
        return;
      }
      router.push(href as any);
    },
    [context, router],
  );

  return {
    navigate,
    isNavigating: context?.isNavigating ?? false,
  };
}
