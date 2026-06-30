export const FEED_SUGGESTION_CATEGORIES = ["Entertainment", "Tech", "Economy"] as const;
export type FeedSuggestionCategory = (typeof FEED_SUGGESTION_CATEGORIES)[number];

export const FEED_SUGGESTION_HORIZONS = ["near_term", "long_term"] as const;
export type FeedSuggestionHorizon = (typeof FEED_SUGGESTION_HORIZONS)[number];

export const FEED_SUGGESTION_SLOTS = ["08:00", "12:00", "15:00"] as const;
export type FeedSuggestionSlot = (typeof FEED_SUGGESTION_SLOTS)[number];

export type FeedSuggestionSourceType =
  | "official"
  | "regulatory_filing"
  | "credible_media"
  | "social"
  | "other";

export interface FeedSuggestionEvidenceSource {
  url: string;
  title: string;
  publisher: string;
  published_at?: string;
  source_type: FeedSuggestionSourceType;
  supports: string;
}

export interface NormalizedFeedSuggestion {
  category: FeedSuggestionCategory;
  subject: string;
  horizon: FeedSuggestionHorizon;
  question: string;
  description: string;
  options: string[];
  suggestedClosesAt: string;
  rationale: string;
  evidenceSources: FeedSuggestionEvidenceSource[];
  resolutionSourceUrl: string;
  resolutionCriteria: string;
  eventStartAt?: string;
  expectedResolutionAt?: string;
  closeDateReason: string;
  resolutionDateSourceUrl: string;
  engagementScore: number;
}

export interface GeminiFeedSuggestionsResult {
  suggestions: NormalizedFeedSuggestion[];
  searchQueries: string[];
  sourceUrls: string[];
  model: string;
}

const SLOT_BY_ET_HOUR: Record<number, FeedSuggestionSlot> = {
  8: "08:00",
  12: "12:00",
  15: "15:00",
};

export function getAmericaNewYorkParts(date: Date): { runDate: string; hour: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    runDate: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number.parseInt(get("hour"), 10),
  };
}

export function resolveFeedSuggestionSlot(
  date: Date,
  forcedSlot?: string,
): FeedSuggestionSlot | null {
  if (forcedSlot && FEED_SUGGESTION_SLOTS.includes(forcedSlot as FeedSuggestionSlot)) {
    return forcedSlot as FeedSuggestionSlot;
  }
  const { hour } = getAmericaNewYorkParts(date);
  return SLOT_BY_ET_HOUR[hour] ?? null;
}

export function buildFeedSuggestionsPrompt(now: Date): string {
  const today = getAmericaNewYorkParts(now).runDate;

  return `You are the senior editorial curator for a public prediction-market feed. Today is ${today} (America/New_York).

Your job is not just to summarize news. You must find topics people will actually want to debate, share, and bet on.

Search current news and upcoming events, then propose exactly 12 binary or multi-option prediction markets.

Before returning the final 12:
1. Scout at least 6 candidate subjects per category using Google Search.
2. Score candidates internally for:
   - mainstream recognition: will a casual user know/care about this?
   - controversy or uncertainty: is there real debate, not an obvious answer?
   - conversation value: would this spark comments, group chats, or social sharing?
   - entertainment factor: is it fun, surprising, dramatic, aspirational, or culturally relevant?
   - resolution clarity: can the outcome be objectively verified from public sources?
   - freshness: is there a current news hook or upcoming event?
3. Discard candidates that are dull, too niche, already resolved, too technical, low-stakes, or not objectively resolvable.
4. Prefer high-salience topics with names/events users recognize (e.g. F1 title race, World Cup, Avengers: Doomsday, SpaceX IPO, major AI launches, celebrity/legal/business drama, blockbuster deals).

Categories (4 markets each = 12 total):
1. Entertainment — focus: movies, TV/sci-fi, celebrities
2. Tech — focus: AI, drones, cars, aviation
3. Economy — focus: finance, fintech, valuations, IPOs, mergers

For EACH category:
- Pick the 2 most engaging subjects from the scored candidate pool.
- For EACH subject, create 2 markets:
  - near_term: resolves within days or weeks (e.g. tomorrow's match, this week's earnings)
  - long_term: resolves months or longer (e.g. championship winner, IPO timing, merger closing)

Requirements:
- Questions must be specific, resolvable, and tied to real-world events.
- Prefer globally notable stories over obscure industry updates.
- Make the question phrasing punchy and feed-friendly while staying precise.
- Avoid dry "will company X report revenue Y" markets unless the company/event is widely interesting or the outcome is dramatic.
- Avoid duplicate angles across the 12 suggestions; each subject should feel distinct.
- Each market needs 2+ clear options (Yes/No for binary, or named outcomes for multi-option).
- suggested_closes_at must be ISO 8601 UTC and AFTER now; near_term within ~30 days, long_term further out.
- Rationale must explain the hook and why users would care, not just repeat the question.
- Include per-market evidence_sources. Prefer official sources; if unavailable, use 2+ credible media sources.
- Include resolution_criteria that an admin or future resolver can follow without guessing.
- Include event_start_at when the market is tied to a known event start time.
- Include expected_resolution_at for when the outcome should be knowable.
- Include close_date_reason explaining why suggested_closes_at is before the event/outcome.
- Include resolution_source_url and resolution_date_source_url when available.
- Include engagement_score from 0-100 based on mainstream appeal, debate, freshness, and shareability.

Return JSON matching the schema exactly with a "suggestions" array of 12 items.`;
}

export const GEMINI_FEED_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string", enum: [...FEED_SUGGESTION_CATEGORIES] },
          subject: { type: "string" },
          horizon: { type: "string", enum: [...FEED_SUGGESTION_HORIZONS] },
          question: { type: "string" },
          description: { type: "string" },
          options: { type: "array", items: { type: "string" }, minItems: 2 },
          suggested_closes_at: { type: "string" },
          rationale: { type: "string" },
          evidence_sources: {
            type: "array",
            items: {
              type: "object",
              properties: {
                url: { type: "string" },
                title: { type: "string" },
                publisher: { type: "string" },
                published_at: { type: "string" },
                source_type: {
                  type: "string",
                  enum: ["official", "regulatory_filing", "credible_media", "social", "other"],
                },
                supports: { type: "string" },
              },
              required: ["url", "title", "publisher", "source_type", "supports"],
            },
            minItems: 1,
          },
          resolution_source_url: { type: "string" },
          resolution_criteria: { type: "string" },
          event_start_at: { type: "string" },
          expected_resolution_at: { type: "string" },
          close_date_reason: { type: "string" },
          resolution_date_source_url: { type: "string" },
          engagement_score: { type: "number" },
        },
        required: [
          "category",
          "subject",
          "horizon",
          "question",
          "description",
          "options",
          "suggested_closes_at",
          "rationale",
          "evidence_sources",
          "resolution_source_url",
          "resolution_criteria",
          "expected_resolution_at",
          "close_date_reason",
          "resolution_date_source_url",
          "engagement_score",
        ],
      },
      minItems: 1,
    },
  },
  required: ["suggestions"],
} as const;

function isCategory(value: string): value is FeedSuggestionCategory {
  return (FEED_SUGGESTION_CATEGORIES as readonly string[]).includes(value);
}

function isHorizon(value: string): value is FeedSuggestionHorizon {
  return (FEED_SUGGESTION_HORIZONS as readonly string[]).includes(value);
}

function normalizeOptionalIsoDate(value: unknown): string | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function clampScore(value: unknown): number {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeEvidenceSources(raw: unknown): FeedSuggestionEvidenceSource[] {
  if (!Array.isArray(raw)) return [];
  const sources: FeedSuggestionEvidenceSource[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const url = String(row.url ?? "").trim();
    if (!url) continue;
    const sourceType = String(row.source_type ?? "other").trim() as FeedSuggestionSourceType;
    sources.push({
        url,
        title: String(row.title ?? "").trim() || url,
        publisher: String(row.publisher ?? "").trim(),
        published_at: normalizeOptionalIsoDate(row.published_at),
        source_type: ["official", "regulatory_filing", "credible_media", "social", "other"].includes(sourceType)
          ? sourceType
          : "other",
        supports: String(row.supports ?? "").trim(),
    });
  }
  return sources;
}

export function normalizeGeminiFeedSuggestions(raw: unknown): NormalizedFeedSuggestion[] {
  if (!raw || typeof raw !== "object") {
    throw new Error("Gemini response is not an object");
  }

  const suggestions = (raw as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    throw new Error("Gemini response missing suggestions array");
  }

  const normalized: NormalizedFeedSuggestion[] = [];

  for (const item of suggestions) {
    if (!item || typeof item !== "object") continue;

    const row = item as Record<string, unknown>;
    const category = String(row.category ?? "").trim();
    const horizon = String(row.horizon ?? "").trim();
    const question = String(row.question ?? "").trim();
    const subject = String(row.subject ?? "").trim();

    if (!isCategory(category) || !isHorizon(horizon) || !question || !subject) {
      continue;
    }

    const options = Array.isArray(row.options)
      ? row.options.map((opt) => String(opt).trim()).filter(Boolean)
      : [];

    if (options.length < 2) continue;

    const suggestedClosesAt = String(row.suggested_closes_at ?? "").trim();
    const closesDate = new Date(suggestedClosesAt);
    if (Number.isNaN(closesDate.getTime())) continue;
    const expectedResolutionAt = normalizeOptionalIsoDate(row.expected_resolution_at);
    if (!expectedResolutionAt) continue;

    normalized.push({
      category,
      subject,
      horizon,
      question,
      description: String(row.description ?? "").trim() || question,
      options,
      suggestedClosesAt: closesDate.toISOString(),
      rationale: String(row.rationale ?? "").trim(),
      evidenceSources: normalizeEvidenceSources(row.evidence_sources),
      resolutionSourceUrl: String(row.resolution_source_url ?? "").trim(),
      resolutionCriteria: String(row.resolution_criteria ?? "").trim(),
      eventStartAt: normalizeOptionalIsoDate(row.event_start_at),
      expectedResolutionAt,
      closeDateReason: String(row.close_date_reason ?? "").trim(),
      resolutionDateSourceUrl: String(row.resolution_date_source_url ?? "").trim(),
      engagementScore: clampScore(row.engagement_score),
    });
  }

  if (normalized.length === 0) {
    throw new Error("No valid suggestions after normalization");
  }

  return normalized;
}

function extractGroundingMetadata(data: Record<string, unknown>): {
  sourceUrls: string[];
  searchQueries: string[];
} {
  const candidate = (data.candidates as unknown[] | undefined)?.[0] as
    | Record<string, unknown>
    | undefined;
  const grounding = candidate?.groundingMetadata as Record<string, unknown> | undefined;

  const sourceUrls = new Set<string>();
  const searchQueries = new Set<string>();

  const chunks = grounding?.groundingChunks as unknown[] | undefined;
  for (const chunk of chunks ?? []) {
    const web = (chunk as { web?: { uri?: string } })?.web;
    if (web?.uri) sourceUrls.add(web.uri);
  }

  const supports = grounding?.groundingSupports as unknown[] | undefined;
  for (const support of supports ?? []) {
    const queries = (support as { googleSearchQueries?: string[] })?.googleSearchQueries;
    for (const query of queries ?? []) {
      if (query) searchQueries.add(query);
    }
  }

  const retrieval = grounding?.webSearchQueries as string[] | undefined;
  for (const query of retrieval ?? []) {
    if (query) searchQueries.add(query);
  }

  return {
    sourceUrls: [...sourceUrls],
    searchQueries: [...searchQueries],
  };
}

export async function generateFeedSuggestionsWithGemini(params: {
  apiKey: string;
  model?: string;
  now?: Date;
}): Promise<GeminiFeedSuggestionsResult> {
  const model = params.model ?? "gemini-2.5-flash";
  const now = params.now ?? new Date();
  const prompt = buildFeedSuggestionsPrompt(now);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${params.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: GEMINI_FEED_RESPONSE_SCHEMA,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const candidate = (data.candidates as unknown[] | undefined)?.[0] as
    | Record<string, unknown>
    | undefined;
  const text = (candidate?.content as { parts?: { text?: string }[] })?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini returned no text content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini returned invalid JSON");
  }

  const suggestions = normalizeGeminiFeedSuggestions(parsed);
  const { sourceUrls, searchQueries } = extractGroundingMetadata(data);

  return {
    suggestions,
    sourceUrls,
    searchQueries,
    model,
  };
}
