import type { TextStyle } from "react-native";

import { Fonts } from "@/constants/theme";

/**
 * App-wide font weights: heaviest allowed is semibold (600).
 * Prefer regular (400) and thin (300) for body and display copy.
 */
export const FontWeight = {
  thin: "300" as const,
  regular: "400" as const,
  semibold: "600" as const,
} as const;

export type FontWeightKey = keyof typeof FontWeight;

export type TextVariant =
  | "display"
  | "title1"
  | "title2"
  | "title3"
  | "body"
  | "bodySm"
  | "label"
  | "caption"
  | "mono";

export type TextColorRole =
  | "default"
  | "secondary"
  | "muted"
  | "primary"
  | "destructive"
  | "success"
  | "onPrimary";

/** Single source of truth for all text sizing, weight, and line height. */
export const TextVariants: Record<TextVariant, TextStyle> = {
  display: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: FontWeight.regular,
  },
  title1: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: FontWeight.regular,
  },
  title2: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: FontWeight.semibold,
  },
  title3: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: FontWeight.semibold,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: FontWeight.regular,
  },
  bodySm: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: FontWeight.regular,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: FontWeight.semibold,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: FontWeight.regular,
  },
  mono: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: FontWeight.regular,
    fontFamily: Fonts.mono,
  },
};

/** @deprecated Use TextVariants via AppText instead. */
export const Typography = {
  label: { fontWeight: FontWeight.semibold },
  emphasis: { fontWeight: FontWeight.semibold },
  heading: { fontWeight: FontWeight.regular },
} as const;

export function getTextStyle(variant: TextVariant): TextStyle {
  return TextVariants[variant];
}
