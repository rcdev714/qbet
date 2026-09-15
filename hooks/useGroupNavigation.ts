import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useCallback } from "react";

import { useIsDesktopWebNav } from "@/contexts/NavigationLayoutContext";
import { usePremiumNavigation } from "@/hooks/usePremiumNavigation";

export type OpenGroupOptions = {
  onboarding?: string;
  message?: string;
};

export function resolveGroupHref(groupId: string, isDesktopWebNav: boolean): Href {
  if (isDesktopWebNav) {
    return {
      pathname: "/(tabs)/groups/[id]",
      params: { id: groupId },
    } as Href;
  }
  return `/group/${groupId}` as Href;
}

export function useGroupNavigation() {
  const router = useRouter();
  const isDesktopWebNav = useIsDesktopWebNav();
  const { navigate: premiumNavigate } = usePremiumNavigation();

  const openGroup = useCallback(
    (groupId: string, options?: OpenGroupOptions) => {
      const params: Record<string, string> = { id: groupId };
      if (options?.onboarding) {
        params.onboarding = options.onboarding;
      }

      if (isDesktopWebNav) {
        router.push({
          pathname: "/(tabs)/groups/[id]",
          params,
        } as Href);
        return;
      }

      premiumNavigate(
        {
          pathname: "/group/[id]",
          params,
        } as Href,
        options?.message ? { message: options.message } : undefined,
      );
    },
    [isDesktopWebNav, premiumNavigate, router],
  );

  return { openGroup, isDesktopWebNav };
}
