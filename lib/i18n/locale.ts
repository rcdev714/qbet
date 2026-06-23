export type UiLocale = "en" | "es";

export const SPANISH_SPEAKING_COUNTRY_CODES = [
  "EC",
  "MX",
  "CO",
  "PE",
  "CL",
  "AR",
  "ES",
] as const;

export type SpanishSpeakingCountryCode = (typeof SPANISH_SPEAKING_COUNTRY_CODES)[number];

export function resolveUiLocale(countryCode: string | null | undefined): UiLocale {
  if (!countryCode) return "en";
  return SPANISH_SPEAKING_COUNTRY_CODES.includes(
    countryCode.toUpperCase() as SpanishSpeakingCountryCode,
  )
    ? "es"
    : "en";
}

export function resolveIntlLocale(countryCode: string | null | undefined): string {
  const code = (countryCode || "US").toUpperCase();
  const ui = resolveUiLocale(code);
  if (ui === "es") {
    if (code === "EC") return "es-EC";
    if (code === "MX") return "es-MX";
    if (code === "ES") return "es-ES";
    return "es";
  }
  return "en-US";
}

export function resolvePolicyLocale(countryCode: string | null | undefined): UiLocale {
  return resolveUiLocale(countryCode);
}

export function ogLocaleForCountry(countryCode: string | null | undefined): string {
  return resolveUiLocale(countryCode) === "es" ? "es_ES" : "en_US";
}
