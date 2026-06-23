import React, { createContext, useContext, useMemo } from "react";

type OnboardingGuardContextValue = {
  refreshOnboardingStatus: () => Promise<void>;
};

const OnboardingGuardContext = createContext<OnboardingGuardContextValue | undefined>(undefined);

export function OnboardingGuardProvider({
  children,
  refreshOnboardingStatus,
}: {
  children: React.ReactNode;
  refreshOnboardingStatus: () => Promise<void>;
}) {
  const value = useMemo(
    () => ({ refreshOnboardingStatus }),
    [refreshOnboardingStatus],
  );

  return (
    <OnboardingGuardContext.Provider value={value}>{children}</OnboardingGuardContext.Provider>
  );
}

export function useOnboardingGuard() {
  const context = useContext(OnboardingGuardContext);
  if (!context) {
    throw new Error("useOnboardingGuard must be used within OnboardingGuardProvider");
  }
  return context;
}
