import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { useAppLocale } from "@/contexts/LocaleContext";
import {
    DEFAULT_JURISDICTION,
    resolveJurisdiction,
    type ComplianceJurisdiction,
} from "@/lib/compliance/jurisdiction";

const STORAGE_KEY = "anymarket:policy-view-jurisdiction";

type PolicyFrameworkContextValue = {
  viewJurisdiction: ComplianceJurisdiction;
  userJurisdiction: ComplianceJurisdiction;
  setViewJurisdiction: (jurisdiction: ComplianceJurisdiction) => void;
};

const PolicyFrameworkContext = createContext<PolicyFrameworkContextValue | undefined>(
  undefined,
);

function readStoredJurisdiction(): ComplianceJurisdiction | null {
  if (typeof sessionStorage === "undefined") return null;
  const value = sessionStorage.getItem(STORAGE_KEY);
  return value === "EC" || value === "US" ? value : null;
}

function writeStoredJurisdiction(jurisdiction: ComplianceJurisdiction) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, jurisdiction);
}

export function PolicyFrameworkProvider({ children }: { children: React.ReactNode }) {
  const { residence } = useAppLocale();
  const userJurisdiction = useMemo(
    () =>
      residence?.jurisdiction ??
      (residence?.country_of_residence
        ? resolveJurisdiction(residence.country_of_residence)
        : DEFAULT_JURISDICTION),
    [residence?.country_of_residence, residence?.jurisdiction],
  );

  const [viewJurisdiction, setViewJurisdictionState] = useState<ComplianceJurisdiction>(() => {
    return readStoredJurisdiction() ?? DEFAULT_JURISDICTION;
  });

  useEffect(() => {
    if (residence?.country_of_residence) {
      setViewJurisdictionState(userJurisdiction);
      return;
    }
    const stored = readStoredJurisdiction();
    setViewJurisdictionState(stored ?? userJurisdiction);
  }, [userJurisdiction, residence?.country_of_residence]);

  const setViewJurisdiction = (jurisdiction: ComplianceJurisdiction) => {
    setViewJurisdictionState(jurisdiction);
    writeStoredJurisdiction(jurisdiction);
  };

  const value = useMemo(
    () => ({
      viewJurisdiction,
      userJurisdiction,
      setViewJurisdiction,
    }),
    [viewJurisdiction, userJurisdiction],
  );

  return (
    <PolicyFrameworkContext.Provider value={value}>{children}</PolicyFrameworkContext.Provider>
  );
}

export function usePolicyFramework() {
  const context = useContext(PolicyFrameworkContext);
  if (!context) {
    throw new Error("usePolicyFramework must be used within PolicyFrameworkProvider");
  }
  return context;
}
