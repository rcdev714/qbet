export type ComplianceJurisdiction = "EC" | "US";

export const DEFAULT_JURISDICTION: ComplianceJurisdiction = "US";

export function resolveJurisdiction(countryCode: string): ComplianceJurisdiction {
  return countryCode.toUpperCase() === "EC" ? "EC" : "US";
}

export function getJurisdictionLabel(jurisdiction: ComplianceJurisdiction): string {
  switch (jurisdiction) {
    case "EC":
      return "Ecuador compliance framework";
    case "US":
      return "United States compliance framework";
    default:
      return "Compliance framework";
  }
}

export function getJurisdictionDisclaimer(jurisdiction: ComplianceJurisdiction): string {
  switch (jurisdiction) {
    case "EC":
      return "Applies Ecuador-specific market rules, KYC posture, and legal disclosures. Anymarkt is not a licensed sportsbook operator.";
    case "US":
      return "Applies United States legal disclosures and market rules. State and local laws may impose additional restrictions.";
    default:
      return "";
  }
}

export function getResidenceFrameworkNotice(countryCode: string): string {
  if (countryCode.toUpperCase() === "EC") {
    return "You will use the Ecuador compliance framework, including Ecuador-specific market and payment rules.";
  }
  return "You will use the United States compliance framework for all legal and payment rules.";
}

/** Stripe Connect expects lowercase ISO country codes */
export function toStripeCountryCode(countryCode: string): string {
  return countryCode.toLowerCase();
}
