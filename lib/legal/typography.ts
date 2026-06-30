import { Brand } from "@/constants/theme";
import { Platform } from "react-native";

export const LEGAL_COLORS = {
  pageBg: "#FFFFFF",
  paperBg: "#FFFFFF",
  paperBorder: "#E5E7EB",
  ink: "#1C1917",
  inkMuted: "#57534E",
  inkLight: "#78716C",
  rule: "#D1D5DB",
  ruleDark: "#9CA3AF",
  link: Brand.primary,
  linkVisited: "#512DA8",
  seal: Brand.deep,
  utilityBarBg: "#FFFFFF",
} as const;

/** Closing sections rendered with the same divider treatment on every policy page. */
export const LEGAL_FORMAL_SECTION_HEADINGS = new Set([
  "Related Anymarkt Policies",
  "Legal and Regulatory Frameworks",
  "Contact",
  "Políticas Relacionadas de Anymarkt",
  "Marcos Legales y Regulatorios",
  "Contacto",
]);

/** Shared stack options so all six legal routes use the same canvas background. */
export const LEGAL_STACK_SCREEN_OPTIONS = {
  contentStyle: { backgroundColor: LEGAL_COLORS.pageBg },
} as const;

export const LEGAL_FONT_FAMILY = {
  body: "LegalSerif",
  bodySemiBold: "LegalSerifSemiBold",
  bodyBold: "LegalSerifBold",
  ui: "LegalSans",
  uiSemiBold: "LegalSansSemiBold",
  uiBold: "LegalSansBold",
} as const;

export const LEGAL_FONT_FALLBACK = {
  body: Platform.select({
    ios: "Georgia",
    android: "serif",
    default: 'Georgia, "Times New Roman", Times, serif',
  }),
  ui: Platform.select({
    ios: "Helvetica Neue",
    android: "sans-serif",
    default: 'Arial, Helvetica, sans-serif',
  }),
} as const;

export const LEGAL_LAYOUT = {
  maxWidth: 680,
  paperMaxWidth: 720,
  pagePaddingH: 16,
  paperPaddingH: 40,
  paperPaddingV: 44,
  sectionGap: 28,
  paragraphGap: 12,
  clauseIndent: 24,
} as const;

export const LEGAL_TYPE = {
  orgLine: {
    fontFamily: LEGAL_FONT_FAMILY.uiSemiBold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.8,
    textTransform: "uppercase" as const,
    color: LEGAL_COLORS.inkMuted,
    textAlign: "center" as const,
  },
  docTitle: {
    fontFamily: LEGAL_FONT_FAMILY.bodyBold,
    fontSize: 26,
    lineHeight: 34,
    color: LEGAL_COLORS.ink,
    textAlign: "center" as const,
    marginTop: 10,
  },
  framework: {
    fontFamily: LEGAL_FONT_FAMILY.ui,
    fontSize: 14,
    lineHeight: 20,
    color: LEGAL_COLORS.inkMuted,
    textAlign: "center" as const,
    marginTop: 8,
  },
  meta: {
    fontFamily: LEGAL_FONT_FAMILY.ui,
    fontSize: 12,
    lineHeight: 18,
    color: LEGAL_COLORS.inkLight,
    textAlign: "center" as const,
    marginTop: 6,
  },
  sectionHeading: {
    fontFamily: LEGAL_FONT_FAMILY.uiBold,
    fontSize: 17,
    lineHeight: 24,
    color: LEGAL_COLORS.seal,
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  paragraph: {
    fontFamily: LEGAL_FONT_FAMILY.body,
    fontSize: 17,
    lineHeight: 27,
    color: LEGAL_COLORS.ink,
  },
  clauseLabel: {
    fontFamily: LEGAL_FONT_FAMILY.bodySemiBold,
    fontSize: 17,
    lineHeight: 27,
    color: LEGAL_COLORS.ink,
  },
  bullet: {
    fontFamily: LEGAL_FONT_FAMILY.body,
    fontSize: 17,
    lineHeight: 27,
    color: LEGAL_COLORS.ink,
  },
  utility: {
    fontFamily: LEGAL_FONT_FAMILY.ui,
    fontSize: 14,
    lineHeight: 20,
    color: LEGAL_COLORS.link,
  },
  link: {
    color: LEGAL_COLORS.link,
    textDecorationLine: "underline" as const,
  },
} as const;

export function legalFont(
  family: keyof typeof LEGAL_FONT_FAMILY,
  fontsLoaded: boolean,
): string | undefined {
  if (fontsLoaded) {
    return LEGAL_FONT_FAMILY[family];
  }
  if (family.startsWith("LegalSerif")) {
    return LEGAL_FONT_FALLBACK.body;
  }
  return LEGAL_FONT_FALLBACK.ui;
}
