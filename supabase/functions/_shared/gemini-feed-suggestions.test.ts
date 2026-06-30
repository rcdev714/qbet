import {
    assertEquals,
    assertThrows,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
    scoreEvidenceSources,
    scoreSuggestionForAutopilot,
    validateSuggestedCloseDate,
} from "./feed-suggestion-resolution.ts";
import {
    buildFeedSuggestionsPrompt,
    getAmericaNewYorkParts,
    normalizeGeminiFeedSuggestions,
    resolveFeedSuggestionSlot,
} from "./gemini-feed-suggestions.ts";

Deno.test("getAmericaNewYorkParts returns YYYY-MM-DD and hour", () => {
  const parts = getAmericaNewYorkParts(new Date("2026-06-24T17:00:00.000Z"));
  assertEquals(parts.runDate, "2026-06-24");
  assertEquals(parts.hour, 13);
});

Deno.test("resolveFeedSuggestionSlot maps ET hours and forced slot", () => {
  const noonEt = new Date("2026-01-15T17:00:00.000Z");
  assertEquals(resolveFeedSuggestionSlot(noonEt), "12:00");
  assertEquals(resolveFeedSuggestionSlot(noonEt, "15:00"), "15:00");
  assertEquals(resolveFeedSuggestionSlot(new Date("2026-01-15T10:00:00.000Z")), null);
});

Deno.test("buildFeedSuggestionsPrompt includes categories and date", () => {
  const prompt = buildFeedSuggestionsPrompt(new Date("2026-06-24T17:00:00.000Z"));
  assertEquals(prompt.includes("Entertainment"), true);
  assertEquals(prompt.includes("Economy"), true);
  assertEquals(prompt.includes("2026-06-24"), true);
  assertEquals(prompt.includes("Score candidates internally"), true);
  assertEquals(prompt.includes("entertainment factor"), true);
  assertEquals(prompt.includes("Discard candidates that are dull"), true);
  assertEquals(prompt.includes("evidence_sources"), true);
  assertEquals(prompt.includes("resolution_criteria"), true);
  assertEquals(prompt.includes("engagement_score"), true);
});

Deno.test("normalizeGeminiFeedSuggestions validates and maps rows", () => {
  const result = normalizeGeminiFeedSuggestions({
    suggestions: [
      {
        category: "Tech",
        subject: "SpaceX IPO",
        horizon: "long_term",
        question: "Will SpaceX IPO before 2027?",
        description: "SpaceX IPO timing market",
        options: ["Yes", "No"],
        suggested_closes_at: "2027-01-01T00:00:00.000Z",
        rationale: "Major finance story",
        evidence_sources: [
          {
            url: "https://www.spacex.com/news",
            title: "SpaceX update",
            publisher: "SpaceX",
            source_type: "official",
            supports: "Official company source for SpaceX activity",
          },
        ],
        resolution_source_url: "https://www.sec.gov/",
        resolution_criteria: "Resolves Yes if SpaceX completes a public IPO before 2027; otherwise No.",
        expected_resolution_at: "2027-01-01T00:00:00.000Z",
        close_date_reason: "Closes before the deadline so users cannot bet after the outcome is known.",
        resolution_date_source_url: "https://www.sec.gov/",
        engagement_score: 92,
      },
    ],
  });

  assertEquals(result.length, 1);
  assertEquals(result[0].category, "Tech");
  assertEquals(result[0].options, ["Yes", "No"]);
  assertEquals(result[0].evidenceSources[0].source_type, "official");
  assertEquals(result[0].engagementScore, 92);
});

Deno.test("normalizeGeminiFeedSuggestions rejects empty payload", () => {
  assertThrows(() => normalizeGeminiFeedSuggestions({ suggestions: [] }));
  assertThrows(() => normalizeGeminiFeedSuggestions(null));
});

Deno.test("scoreEvidenceSources prefers official and credible sources", () => {
  const score = scoreEvidenceSources([
    {
      url: "https://www.sec.gov/example",
      title: "SEC filing",
      publisher: "SEC",
      source_type: "regulatory_filing",
      supports: "Filing source",
    },
    {
      url: "https://www.reuters.com/example",
      title: "Reuters report",
      publisher: "Reuters",
      source_type: "credible_media",
      supports: "Credible report",
    },
  ]);

  assertEquals(score.hasOfficialSource, true);
  assertEquals(score.sourceCount, 2);
  assertEquals(score.sourceQualityScore >= 90, true);
});

Deno.test("validateSuggestedCloseDate enforces close before resolution", () => {
  const [suggestion] = normalizeGeminiFeedSuggestions({
    suggestions: [
      {
        category: "Entertainment",
        subject: "Awards",
        horizon: "near_term",
        question: "Will a film win best picture?",
        description: "Awards market",
        options: ["Yes", "No"],
        suggested_closes_at: "2026-07-01T00:00:00.000Z",
        rationale: "A popular awards debate.",
        evidence_sources: [
          {
            url: "https://www.oscars.org/",
            title: "Oscars",
            publisher: "Academy",
            source_type: "official",
            supports: "Official event source",
          },
        ],
        resolution_source_url: "https://www.oscars.org/",
        resolution_criteria: "Resolves Yes if the named film wins best picture at the official ceremony.",
        event_start_at: "2026-07-01T03:00:00.000Z",
        expected_resolution_at: "2026-07-01T06:00:00.000Z",
        close_date_reason: "Closes before the ceremony starts.",
        resolution_date_source_url: "https://www.oscars.org/",
        engagement_score: 90,
      },
    ],
  });

  const validation = validateSuggestedCloseDate(suggestion, new Date("2026-06-24T00:00:00.000Z"));
  assertEquals(validation.ok, true);
  assertEquals(validation.score, 100);
});

Deno.test("scoreSuggestionForAutopilot marks high-quality suggestion eligible", () => {
  const [suggestion] = normalizeGeminiFeedSuggestions({
    suggestions: [
      {
        category: "Tech",
        subject: "Major AI Launch",
        horizon: "near_term",
        question: "Will a major AI lab announce a new flagship model by July 15?",
        description: "AI launch market",
        options: ["Yes", "No"],
        suggested_closes_at: "2026-07-14T00:00:00.000Z",
        rationale: "AI model launches drive broad debate.",
        evidence_sources: [
          {
            url: "https://openai.com/news/",
            title: "OpenAI News",
            publisher: "OpenAI",
            source_type: "official",
            supports: "Official announcement channel",
          },
        ],
        resolution_source_url: "https://openai.com/news/",
        resolution_criteria: "Resolves Yes if the official OpenAI news page announces a new flagship model by the deadline.",
        expected_resolution_at: "2026-07-15T00:00:00.000Z",
        close_date_reason: "Closes one day before the deadline.",
        resolution_date_source_url: "https://openai.com/news/",
        engagement_score: 95,
      },
    ],
  });

  const score = scoreSuggestionForAutopilot({
    suggestion,
    now: new Date("2026-06-24T00:00:00.000Z"),
  });

  assertEquals(score.autopilotStatus, "eligible");
});
