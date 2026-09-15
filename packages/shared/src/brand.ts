export const BRAND_NAME = "Anymarkt";
export const BRAND_DOMAIN = "anymarkt.com";
export const APP_URL = "https://anymarkt.com";
export const SUPPORT_EMAIL = "support@anymarkt.com";
export const FROM_EMAIL = "onboarding@anymarkt.com";
export const TAGLINE = "Predict the Future with friends";
export const DEFAULT_SEO_TITLE = `${BRAND_NAME} | ${TAGLINE}`;
export const DEFAULT_SEO_DESCRIPTION =
  "Anymarkt is a social prediction market platform where friends create private markets, back predictions, and get rewarded for seeing what comes next.";
export const DEFAULT_SEO_KEYWORDS =
  "Anymarkt, anymarkt.com, social prediction market, predict with friends, private prediction markets, future predictions, prediction rewards, group predictions";
export const DEFAULT_OG_IMAGE_ALT = "Anymarkt social prediction market preview";

/** Shared brand color tokens (web + native). */
export const Brand = {
  primary: "#006ADC",
  primarySoft: "#DBEAFE",
  deep: "#1A2F5C",
  onPrimary: "#FFFFFF",
  success: "#22C55E",
  error: "#DC2626",
  warning: "#FBBF24",
  mutedText: "#526173",
} as const;

export const Marketing = {
  heroBackground: "#030712",
  heroBorder: "rgba(255, 255, 255, 0.08)",
  heroSurface: "rgba(255, 255, 255, 0.04)",
  textMuted: "#94A3B8",
  textLink: "#93C5FD",
  accent: Brand.primary,
} as const;

export const WHATSAPP_CONTACT_DISPLAY = "+593939800968";
const WHATSAPP_CONTACT_E164 = "593939800968";

export function getWhatsAppContactUrl(message?: string): string {
  const text = encodeURIComponent(
    message ?? `Hi, I would like to request ${BRAND_NAME} beta access.`,
  );
  return `https://wa.me/${WHATSAPP_CONTACT_E164}?text=${text}`;
}
