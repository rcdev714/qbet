export type BootstrapLoaderInput = {
  loading: boolean;
  hasSession: boolean;
  policyCheckDone: boolean;
  userId?: string | null;
};

export function getInitialClientMountState(isWeb: boolean): boolean {
  return !isWeb;
}

export function shouldRenderClientOnlyChildren(mounted: boolean): boolean {
  return mounted;
}

export function shouldShowBootstrapLoader(input: BootstrapLoaderInput): boolean {
  const { loading, hasSession, policyCheckDone, userId } = input;
  return loading || (hasSession && (!policyCheckDone || !userId));
}

export type WebMountFrame = {
  phase: "clientOnlyFirstPaint" | "rootNavFirstPaint" | "rootNavAfterAuthReady";
  clientOnlyMounted: boolean;
  rendersAppShell: boolean;
  showBootstrapLoader: boolean;
  routeGuardActive: boolean;
};

/** Models the web mount sequence for ClientOnlyWebApp + RootLayoutNav. */
export function simulateWebBootstrapMountSequence(
  authLoading: boolean,
  hasSession = false,
  policyCheckDone = !hasSession,
  userId: string | null = hasSession ? "user-1" : null,
): WebMountFrame[] {
  const clientOnlyMountedInitially = getInitialClientMountState(true);

  const rootNavFirstPaint: WebMountFrame = {
    phase: "rootNavFirstPaint",
    clientOnlyMounted: true,
    rendersAppShell: shouldRenderClientOnlyChildren(true),
    showBootstrapLoader: shouldShowBootstrapLoader({
      loading: authLoading,
      hasSession,
      policyCheckDone,
      userId,
    }),
    routeGuardActive: !authLoading && policyCheckDone && !(hasSession && !userId),
  };

  const rootNavAfterAuthReady: WebMountFrame = {
    phase: "rootNavAfterAuthReady",
    clientOnlyMounted: true,
    rendersAppShell: true,
    showBootstrapLoader: shouldShowBootstrapLoader({
      loading: false,
      hasSession,
      policyCheckDone,
      userId,
    }),
    routeGuardActive: true,
  };

  return [
    {
      phase: "clientOnlyFirstPaint",
      clientOnlyMounted: clientOnlyMountedInitially,
      rendersAppShell: shouldRenderClientOnlyChildren(clientOnlyMountedInitially),
      showBootstrapLoader: false,
      routeGuardActive: false,
    },
    rootNavFirstPaint,
    rootNavAfterAuthReady,
  ];
}
