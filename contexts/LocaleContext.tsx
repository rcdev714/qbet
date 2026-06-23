import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuthContext } from "@/contexts/AuthContext";
import { initI18n } from "@/lib/i18n";
import { resolveUiLocale, type UiLocale } from "@/lib/i18n/locale";
import { complianceService, type UserResidence } from "@/services/compliance.service";

type LocaleContextValue = {
  locale: UiLocale;
  countryCode: string | null;
  residence: UserResidence | null;
  setPreviewCountryCode: (countryCode: string | null) => void;
  refreshResidence: () => Promise<void>;
};

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

initI18n("en");

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const { user, hasSession } = useAuthContext();
  const [residence, setResidence] = useState<UserResidence | null>(null);
  const [previewCountryCode, setPreviewCountryCode] = useState<string | null>(null);

  const countryCode = previewCountryCode ?? residence?.country_of_residence ?? null;
  const locale = useMemo(() => resolveUiLocale(countryCode), [countryCode]);

  const refreshResidence = async () => {
    try {
      const next = await complianceService.getUserResidence();
      setResidence(next);
    } catch {
      setResidence(null);
    }
  };

  useEffect(() => {
    if (hasSession && user?.id) {
      void refreshResidence();
    } else if (!hasSession) {
      setResidence(null);
    }
  }, [hasSession, user?.id]);

  useEffect(() => {
    if (i18n.language !== locale) {
      void i18n.changeLanguage(locale);
    }
  }, [i18n, locale]);

  const value = useMemo(
    () => ({
      locale,
      countryCode,
      residence,
      setPreviewCountryCode,
      refreshResidence,
    }),
    [locale, countryCode, residence],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useAppLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useAppLocale must be used within LocaleProvider");
  }
  return context;
}
