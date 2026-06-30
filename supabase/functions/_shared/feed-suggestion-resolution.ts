import type {
    FeedSuggestionEvidenceSource,
    NormalizedFeedSuggestion,
} from "./gemini-feed-suggestions.ts";

export type ResolutionType =
  | "near_term_event"
  | "earnings_or_finance"
  | "award_or_competition"
  | "long_term_event"
  | "unknown";

export interface CloseDateValidation {
  ok: boolean;
  score: number;
  reasons: string[];
  closeDate: string;
  expectedResolutionAt?: string;
}

export interface AutopilotScore {
  sourceQualityScore: number;
  sourceCount: number;
  hasOfficialSource: boolean;
  engagementScore: number;
  resolutionQualityScore: number;
  complianceRiskScore: number;
  duplicateScore: number;
  autopilotScore: number;
  autopilotStatus: "needs_review" | "eligible" | "blocked";
  autopilotReasons: string[];
  suggestedClosesAt: string;
}

const OFFICIAL_DOMAIN_HINTS = [
  ".gov",
  "sec.gov",
  "investor.",
  "ir.",
  "fifa.com",
  "fia.com",
  "formula1.com",
  "theacademy",
  "oscars.org",
  "marvel.com",
  "disney.com",
  "spacex.com",
  "tesla.com",
  "openai.com",
  "anthropic.com",
];

const CREDIBLE_DOMAIN_HINTS = [
  "reuters.com",
  "apnews.com",
  "bloomberg.com",
  "wsj.com",
  "ft.com",
  "cnbc.com",
  "variety.com",
  "hollywoodreporter.com",
  "theverge.com",
  "techcrunch.com",
  "theinformation.com",
  "espn.com",
  "bbc.com",
  "nytimes.com",
  "deadline.com",
];

const LOW_QUALITY_DOMAIN_HINTS = [
  "reddit.com",
  "x.com",
  "twitter.com",
  "tiktok.com",
  "facebook.com",
  "instagram.com",
  "medium.com",
  "substack.com",
];

const SPORTS_CONTENT_PATTERNS: RegExp[] = [
  /\b(sports?|sporting|sportbook|sportsbook)\b/i,
  /\b(futbol|fútbol|football|soccer|basketball|baseball)\b/i,
  /\b(nba|nfl|mlb|nhl|mls|uefa|fifa|ncaa)\b/i,
  /\b(world cup|super bowl|playoffs?|final match|match day)\b/i,
  /\b(will|who)\s+.+\s+(win|beat|defeat|score)\b/i,
];

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function sourceDomainScore(source: FeedSuggestionEvidenceSource): number {
  const domain = domainFromUrl(source.url);
  const type = source.source_type;
  if (!domain) return 0;
  if (type === "official" || OFFICIAL_DOMAIN_HINTS.some((hint) => domain.includes(hint))) {
    return 95;
  }
  if (type === "regulatory_filing") return 90;
  if (type === "credible_media" || CREDIBLE_DOMAIN_HINTS.some((hint) => domain.includes(hint))) {
    return 75;
  }
  if (LOW_QUALITY_DOMAIN_HINTS.some((hint) => domain.includes(hint))) {
    return 25;
  }
  return 50;
}

export function scoreEvidenceSources(sources: FeedSuggestionEvidenceSource[]): {
  sourceQualityScore: number;
  sourceCount: number;
  hasOfficialSource: boolean;
} {
  const unique = new Map<string, FeedSuggestionEvidenceSource>();
  for (const source of sources) {
    if (source.url) unique.set(source.url, source);
  }
  const rows = [...unique.values()];
  const sourceCount = rows.length;
  const hasOfficialSource = rows.some((source) =>
    source.source_type === "official" ||
    source.source_type === "regulatory_filing" ||
    OFFICIAL_DOMAIN_HINTS.some((hint) => domainFromUrl(source.url).includes(hint))
  );

  if (sourceCount === 0) {
    return { sourceQualityScore: 0, sourceCount, hasOfficialSource };
  }

  const best = Math.max(...rows.map(sourceDomainScore));
  const credibleCount = rows.filter((source) => sourceDomainScore(source) >= 70).length;
  const sourceBreadthBonus = Math.min(10, Math.max(0, credibleCount - 1) * 5);

  return {
    sourceQualityScore: clampScore(best + sourceBreadthBonus),
    sourceCount,
    hasOfficialSource,
  };
}

export function classifyResolutionType(suggestion: NormalizedFeedSuggestion): ResolutionType {
  const text = `${suggestion.category} ${suggestion.subject} ${suggestion.question}`.toLowerCase();
  if (suggestion.horizon === "long_term") return "long_term_event";
  if (/earnings|ipo|merger|valuation|fed|rate|filing|sec|finance/.test(text)) {
    return "earnings_or_finance";
  }
  if (/award|oscar|grammy|champion|winner|world cup|f1|final|match|race/.test(text)) {
    return "award_or_competition";
  }
  return "near_term_event";
}

export function deriveCloseDateFromEvidence(
  suggestion: NormalizedFeedSuggestion,
  now = new Date(),
): string {
  const eventStart = suggestion.eventStartAt ? new Date(suggestion.eventStartAt) : null;
  const expectedResolution = suggestion.expectedResolutionAt
    ? new Date(suggestion.expectedResolutionAt)
    : null;
  const modelClose = new Date(suggestion.suggestedClosesAt);

  if (eventStart && !Number.isNaN(eventStart.getTime()) && eventStart > now) {
    return new Date(eventStart.getTime() - 6 * 60 * 60 * 1000).toISOString();
  }

  if (expectedResolution && !Number.isNaN(expectedResolution.getTime()) && expectedResolution > now) {
    return new Date(expectedResolution.getTime() - 24 * 60 * 60 * 1000).toISOString();
  }

  return modelClose.toISOString();
}

export function validateSuggestedCloseDate(
  suggestion: NormalizedFeedSuggestion,
  now = new Date(),
): CloseDateValidation {
  const reasons: string[] = [];
  const expectedResolution = suggestion.expectedResolutionAt
    ? new Date(suggestion.expectedResolutionAt)
    : undefined;
  const derivedClose = new Date(deriveCloseDateFromEvidence(suggestion, now));
  const modelClose = new Date(suggestion.suggestedClosesAt);
  const closeDate = derivedClose > now ? derivedClose : modelClose;

  if (Number.isNaN(closeDate.getTime())) {
    return {
      ok: false,
      score: 0,
      reasons: ["invalid_close_date"],
      closeDate: suggestion.suggestedClosesAt,
      expectedResolutionAt: suggestion.expectedResolutionAt,
    };
  }

  if (closeDate <= now) {
    reasons.push("close_date_not_after_now");
  }

  if (expectedResolution && !Number.isNaN(expectedResolution.getTime())) {
    if (closeDate >= expectedResolution) {
      reasons.push("close_date_not_before_resolution");
    }
  } else {
    reasons.push("missing_expected_resolution_at");
  }

  const horizonMs = closeDate.getTime() - now.getTime();
  const days = horizonMs / (24 * 60 * 60 * 1000);
  if (suggestion.horizon === "near_term" && days > 45) {
    reasons.push("near_term_close_too_far");
  }
  if (suggestion.horizon === "long_term" && days < 21) {
    reasons.push("long_term_close_too_soon");
  }

  if (!suggestion.resolutionCriteria || suggestion.resolutionCriteria.length < 30) {
    reasons.push("weak_resolution_criteria");
  }

  const score = clampScore(100 - (reasons.length * 20));
  return {
    ok: reasons.length === 0,
    score,
    reasons,
    closeDate: closeDate.toISOString(),
    expectedResolutionAt: suggestion.expectedResolutionAt,
  };
}

export function isCloseDateAutopilotSafe(
  suggestion: NormalizedFeedSuggestion,
  now = new Date(),
): boolean {
  return validateSuggestedCloseDate(suggestion, now).ok;
}

export function scoreSuggestionForAutopilot(params: {
  suggestion: NormalizedFeedSuggestion;
  now?: Date;
  duplicateScore?: number;
}): AutopilotScore {
  const now = params.now ?? new Date();
  const evidence = scoreEvidenceSources(params.suggestion.evidenceSources);
  const closeValidation = validateSuggestedCloseDate(params.suggestion, now);
  const combinedText = [
    params.suggestion.category,
    params.suggestion.subject,
    params.suggestion.question,
    params.suggestion.options.join(" "),
  ].join(" ");
  const complianceRiskScore = SPORTS_CONTENT_PATTERNS.some((pattern) => pattern.test(combinedText))
    ? 100
    : 10;
  const duplicateScore = clampScore(params.duplicateScore ?? 0);
  const engagementScore = clampScore(params.suggestion.engagementScore);

  const autopilotScore = clampScore(
    evidence.sourceQualityScore * 0.25 +
      closeValidation.score * 0.25 +
      engagementScore * 0.25 +
      (100 - complianceRiskScore) * 0.15 +
      (100 - duplicateScore) * 0.10,
  );

  const reasons = [
    ...closeValidation.reasons,
  ];
  if (evidence.sourceQualityScore < 75) reasons.push("source_quality_below_threshold");
  if (!evidence.hasOfficialSource && evidence.sourceCount < 2) reasons.push("insufficient_credible_sources");
  if (complianceRiskScore > 20) reasons.push("compliance_risk_high");
  if (duplicateScore > 30) reasons.push("possible_duplicate");
  if (autopilotScore < 85) reasons.push("autopilot_score_below_threshold");

  const autopilotStatus = reasons.length === 0 ? "eligible" : "needs_review";
  return {
    ...evidence,
    engagementScore,
    resolutionQualityScore: closeValidation.score,
    complianceRiskScore,
    duplicateScore,
    autopilotScore,
    autopilotStatus,
    autopilotReasons: reasons,
    suggestedClosesAt: closeValidation.closeDate,
  };
}
