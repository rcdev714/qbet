import accessRequestEn from "./locales/en/accessRequest.json";
import adminEn from "./locales/en/admin.json";
import authEn from "./locales/en/auth.json";
import commonEn from "./locales/en/common.json";
import complianceEn from "./locales/en/compliance.json";
import contractEn from "./locales/en/contract.json";
import errorsEn from "./locales/en/errors.json";
import feedEn from "./locales/en/feed.json";
import groupEn from "./locales/en/group.json";
import groupsEn from "./locales/en/groups.json";
import landingEn from "./locales/en/landing.json";
import marketEn from "./locales/en/market.json";
import onboardingEn from "./locales/en/onboarding.json";
import profileEn from "./locales/en/profile.json";
import settingsEn from "./locales/en/settings.json";
import socialEn from "./locales/en/social.json";
import tabsEn from "./locales/en/tabs.json";
import walletEn from "./locales/en/wallet.json";
import accessRequestEs from "./locales/es/accessRequest.json";
import adminEs from "./locales/es/admin.json";
import authEs from "./locales/es/auth.json";
import commonEs from "./locales/es/common.json";
import complianceEs from "./locales/es/compliance.json";
import contractEs from "./locales/es/contract.json";
import errorsEs from "./locales/es/errors.json";
import feedEs from "./locales/es/feed.json";
import groupEs from "./locales/es/group.json";
import groupsEs from "./locales/es/groups.json";
import landingEs from "./locales/es/landing.json";
import marketEs from "./locales/es/market.json";
import onboardingEs from "./locales/es/onboarding.json";
import profileEs from "./locales/es/profile.json";
import settingsEs from "./locales/es/settings.json";
import socialEs from "./locales/es/social.json";
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
    groups: groupsEn,
    settings: settingsEn,
    social: socialEn,
    errors: errorsEn,
    compliance: complianceEn,
    accessRequest: accessRequestEn,
    admin: adminEn,
    profile: profileEn,
    market: marketEn,
    contract: contractEn,
    landing: landingEn,
  },
  es: {
    auth: authEs,
    common: commonEs,
    onboarding: onboardingEs,
    tabs: tabsEs,
    wallet: walletEs,
    feed: feedEs,
    group: groupEs,
    groups: groupsEs,
    settings: settingsEs,
    social: socialEs,
    errors: errorsEs,
    compliance: complianceEs,
    accessRequest: accessRequestEs,
    admin: adminEs,
    profile: profileEs,
    market: marketEs,
    contract: contractEs,
    landing: landingEs,
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
  "groups",
  "settings",
  "social",
  "errors",
  "compliance",
  "accessRequest",
  "admin",
  "profile",
  "market",
  "contract",
  "landing",
] as const;
