import type { ComplianceJurisdiction } from "./jurisdiction";

export type SupportedCountry = {
  country_code: string;
  name: string;
  dial_code: string;
  default_jurisdiction: ComplianceJurisdiction;
  is_launch_enabled: boolean;
  sort_order: number;
};

/** Fallback when DB table is unavailable (offline/dev) — EC launch beta */
export const FALLBACK_COUNTRIES: SupportedCountry[] = [
  { country_code: "EC", name: "Ecuador", dial_code: "+593", default_jurisdiction: "EC", is_launch_enabled: true, sort_order: 1 },
];

export function countryCodeToFlag(countryCode: string): string {
  const code = countryCode.toUpperCase();
  if (code.length !== 2) return "🌐";
  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0)),
  );
}
