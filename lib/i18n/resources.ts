import accessRequestEn from "./locales/en/accessRequest.json";
import adminEn from "./locales/en/admin.json";
import authEn from "./locales/en/auth.json";
import commonEn from "./locales/en/common.json";
import complianceEn from "./locales/en/compliance.json";
import errorsEn from "./locales/en/errors.json";
import feedEn from "./locales/en/feed.json";
import groupEn from "./locales/en/group.json";
import onboardingEn from "./locales/en/onboarding.json";
import settingsEn from "./locales/en/settings.json";
import tabsEn from "./locales/en/tabs.json";
import walletEn from "./locales/en/wallet.json";
import accessRequestEs from "./locales/es/accessRequest.json";
import adminEs from "./locales/es/admin.json";
import authEs from "./locales/es/auth.json";
import commonEs from "./locales/es/common.json";
import complianceEs from "./locales/es/compliance.json";
import errorsEs from "./locales/es/errors.json";
import feedEs from "./locales/es/feed.json";
import groupEs from "./locales/es/group.json";
import onboardingEs from "./locales/es/onboarding.json";
import settingsEs from "./locales/es/settings.json";
import tabsEs from "./locales/es/tabs.json";
import walletEs from "./locales/es/wallet.json";

export const i18nResources = {
  en: {
    auth: authEn,
    common: commonEn,
    onboarding: onboardingEn,
    tabs: tabsEn,
    wallet: walletEn,
    feed: feedEn,
    group: groupEn,
    settings: settingsEn,
    errors: errorsEn,
    compliance: complianceEn,
    accessRequest: accessRequestEn,
    admin: adminEn,
  },
  es: {
    auth: authEs,
    common: commonEs,
    onboarding: onboardingEs,
    tabs: tabsEs,
    wallet: walletEs,
    feed: feedEs,
    group: groupEs,
    settings: settingsEs,
    errors: errorsEs,
    compliance: complianceEs,
    accessRequest: accessRequestEs,
    admin: adminEs,
  },
} as const;

export const I18N_NAMESPACES = [
  "auth",
  "common",
  "onboarding",
  "tabs",
  "wallet",
  "feed",
  "group",
  "settings",
  "errors",
  "compliance",
  "accessRequest",
  "admin",
] as const;
