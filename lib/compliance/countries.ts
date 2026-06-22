import type { ComplianceJurisdiction } from "./jurisdiction";

export type SupportedCountry = {
  country_code: string;
  name: string;
  dial_code: string;
  default_jurisdiction: ComplianceJurisdiction;
  is_launch_enabled: boolean;
  sort_order: number;
};

/** Fallback when DB table is unavailable (offline/dev) */
export const FALLBACK_COUNTRIES: SupportedCountry[] = [
  { country_code: "EC", name: "Ecuador", dial_code: "+593", default_jurisdiction: "EC", is_launch_enabled: true, sort_order: 1 },
  { country_code: "US", name: "United States", dial_code: "+1", default_jurisdiction: "US", is_launch_enabled: true, sort_order: 2 },
  { country_code: "CA", name: "Canada", dial_code: "+1", default_jurisdiction: "US", is_launch_enabled: true, sort_order: 10 },
  { country_code: "MX", name: "Mexico", dial_code: "+52", default_jurisdiction: "US", is_launch_enabled: true, sort_order: 11 },
  { country_code: "GB", name: "United Kingdom", dial_code: "+44", default_jurisdiction: "US", is_launch_enabled: true, sort_order: 12 },
  { country_code: "CO", name: "Colombia", dial_code: "+57", default_jurisdiction: "US", is_launch_enabled: true, sort_order: 16 },
];

export function countryCodeToFlag(countryCode: string): string {
  const code = countryCode.toUpperCase();
  if (code.length !== 2) return "🌐";
  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0)),
  );
}
