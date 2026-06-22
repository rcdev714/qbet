/**
 * App-wide font weights: heaviest allowed is semibold (600).
 * Prefer regular (400) and thin (300) for body and display copy.
 */
export const FontWeight = {
  thin: "300" as const,
  regular: "400" as const,
  /** Use sparingly; max emphasis in the product is semibold. */
  semibold: "600" as const,
} as const;

export type FontWeightKey = keyof typeof FontWeight;

/** Shared text presets for compliance and navigation UI. */
export const Typography = {
  label: {
    fontWeight: FontWeight.semibold,
  },
  emphasis: {
    fontWeight: FontWeight.semibold,
  },
  heading: {
    fontWeight: FontWeight.regular,
  },
} as const;
