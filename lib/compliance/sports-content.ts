import { isSportsMarketCategory } from "./market-category";

export type SportsContentReasonCode = "ec_sports_market_blocked" | "ec_sports_content_detected";

export type SportsContentScanInput = {
  question?: string | null;
  description?: string | null;
  resolutionSource?: string | null;
  optionLabels?: string[] | null;
  category?: string | null;
};

export type SportsContentScanResult = {
  blocked: boolean;
  reasonCode: SportsContentReasonCode | null;
  matches: string[];
};

const SPORTS_CONTENT_PATTERNS: RegExp[] = [
  /\b(sports?|sporting|sportbook|sportsbook)\b/i,
  /\b(futbol|fútbol|football|soccer|baloncesto|basketball|beisbol|béisbol|baseball)\b/i,
  /\b(nba|nfl|mlb|nhl|mls|uefa|fifa|ncaa)\b/i,
  /\b(premier\s+league|la\s+liga|champions\s+league|world\s+cup|copa\s+america|copa\s+del\s+rey)\b/i,
  /\b(super\s+bowl|playoffs?|final\s+match|match\s+day)\b/i,
  /\b(gol|goles|marcador|tarjeta\s+roja|penalti|penalty\s+kick)\b/i,
  /\b(partido|encuentro|torneo|campeonato|liga\s+ecuabet)\b/i,
  /\b(barcelona|real\s+madrid|manchester|liverpool|chelsea|arsenal|bayern|psg)\b/i,
  /\b(quarterback|touchdown|home\s+run|hat\s+trick|mvp)\b/i,
  /\bvs\.?\b/i,
  /\b(will|who)\s+.+\s+(win|beat|defeat|score)\b/i,
  /\b(ganar|gana|vencer|vence|anotar)\b/i,
];

function collectPatternMatches(text: string): string[] {
  const matches: string[] = [];
  for (const pattern of SPORTS_CONTENT_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[0]) {
      matches.push(match[0].trim());
    }
  }
  return matches;
}

function normalizeTextParts(input: SportsContentScanInput): string[] {
  const parts: string[] = [];
  if (input.question?.trim()) parts.push(input.question.trim());
  if (input.description?.trim()) parts.push(input.description.trim());
  if (input.resolutionSource?.trim()) parts.push(input.resolutionSource.trim());
  for (const label of input.optionLabels ?? []) {
    if (label?.trim()) parts.push(label.trim());
  }
  return parts;
}

export function scanMarketTextForSports(input: SportsContentScanInput): SportsContentScanResult {
  if (input.category && isSportsMarketCategory(input.category)) {
    return {
      blocked: true,
      reasonCode: "ec_sports_market_blocked",
      matches: [input.category],
    };
  }

  const matches = new Set<string>();
  for (const part of normalizeTextParts(input)) {
    for (const match of collectPatternMatches(part)) {
      matches.add(match);
    }
  }

  if (matches.size > 0) {
    return {
      blocked: true,
      reasonCode: "ec_sports_content_detected",
      matches: Array.from(matches),
    };
  }

  return { blocked: false, reasonCode: null, matches: [] };
}

export function getSportsBlockMessage(locale: "en" | "es" = "en"): string {
  return locale === "es"
    ? "Los mercados deportivos y el contenido relacionado con deportes no están permitidos para usuarios de Ecuador."
    : "Sports markets and sports-related content are not permitted for Ecuador users.";
}
