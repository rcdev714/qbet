import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { runtimePath } from "./state";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const FIXTURE_QUESTION = "Will the Playwright feed suggestion E2E pass?";

test.describe("admin feed suggestions", () => {
  test.use({ storageState: runtimePath("admin-storage.json") });

  let batchId: string;
  let suggestionId: string;

  test.beforeAll(async () => {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    batchId = randomUUID();
    suggestionId = randomUUID();
    const runDate = new Date().toISOString().slice(0, 10);

    const { error: batchError } = await admin.from("feed_suggestion_batches").insert({
      id: batchId,
      cron_slot: "12:00",
      run_date: runDate,
      status: "completed",
      triggered_by: "manual",
      suggestion_count: 1,
      gemini_model: "playwright-fixture",
      completed_at: new Date().toISOString(),
    });
    if (batchError) throw batchError;

    const { error: suggestionError } = await admin.from("feed_market_suggestions").insert({
      id: suggestionId,
      batch_id: batchId,
      category: "Economy",
      subject: "Playwright E2E",
      horizon: "long_term",
      question: FIXTURE_QUESTION,
      description: "UI test fixture",
      options: ["Yes", "No"],
      suggested_closes_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      source_urls: ["https://example.com/playwright"],
      search_queries: [],
      rationale: "Automated UI test",
      status: "pending",
    });
    if (suggestionError) throw suggestionError;
  });

  test.afterAll(async () => {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await admin.from("feed_market_suggestions").delete().eq("batch_id", batchId);
    await admin.from("feed_suggestion_batches").delete().eq("id", batchId);
  });

  test("shows pending suggestion and prefill create form", async ({ page }) => {
    await page.goto("/(tabs)/feed?adminFeed=suggestions");
    await expect(page.getByText("Feed Manager (Admin)")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Suggestions")).toBeVisible();
    await expect(page.getByText(FIXTURE_QUESTION)).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Use in Create" }).first().click();
    await expect(page.getByText("Create")).toBeVisible();
    await expect(page.locator("input, textarea").first()).toHaveValue(FIXTURE_QUESTION);
  });

  test("dismisses a suggestion", async ({ page }) => {
    await page.goto("/(tabs)/feed?adminFeed=suggestions");
    await expect(page.getByText(FIXTURE_QUESTION)).toBeVisible({ timeout: 60_000 });

    page.once("dialog", (dialog) => dialog.accept().catch(() => {}));
    await page.getByRole("button", { name: "Dismiss" }).first().click();

    await expect(page.getByText(FIXTURE_QUESTION)).not.toBeVisible({ timeout: 15_000 });
  });
});
