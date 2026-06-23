import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { I18N_NAMESPACES, i18nResources } from "./resources";

let initialized = false;

export function initI18n(defaultLocale: "en" | "es" = "en") {
  if (initialized) {
    if (i18n.language !== defaultLocale) {
      void i18n.changeLanguage(defaultLocale);
    }
    return i18n;
  }

  i18n.use(initReactI18next).init({
    resources: i18nResources,
    lng: defaultLocale,
    fallbackLng: "en",
    ns: [...I18N_NAMESPACES],
    defaultNS: "common",
    interpolation: { escapeValue: false },
    compatibilityJSON: "v4",
  });

  initialized = true;
  return i18n;
}

export { i18n };
