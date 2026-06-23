/**
 * Normalized market category helpers shared by client feed filters and compliance docs.
 * Server-side enforcement lives in SQL (`normalize_market_category`, `is_sports_market_category`).
 */

export function normalizeMarketCategory(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "general_event";
  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const SPORTS_CATEGORY = "sports";

const SPORTS_KEYWORDS = [
  "sport",
  "sports",
  "futbol",
  "fútbol",
  "soccer",
  "nba",
  "nfl",
  "mlb",
  "liga",
  "champions",
  "world_cup",
  "copa",
  "deportivo",
  "deportivos",
  "match",
  "partido",
];

export function isSportsMarketCategory(raw: string | null | undefined): boolean {
  const normalized = normalizeMarketCategory(raw);
  if (normalized === SPORTS_CATEGORY) return true;
  if (normalized.includes(SPORTS_CATEGORY)) return true;
  return SPORTS_KEYWORDS.some(
    (keyword) => normalized.includes(keyword) || normalized === keyword.replace(/[^a-z0-9]+/g, "_"),
  );
}
