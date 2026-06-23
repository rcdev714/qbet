import { expect, test } from "@playwright/test";
import { resolveMarketAsAdmin } from "./helpers/assert-db";
import { acceptDialogs, fillTextInput } from "./helpers/auth";
import { assertLiveModeReady, ensureLiveMode, persistLiveModeStorage, switchToLiveIfNeeded } from "./helpers/live-mode";
import { e2eLog, e2eLogPage } from "./helpers/log";
import { clickBetSideYes, clickVisibleTestId } from "./helpers/ui";
import { loadE2eState, saveE2eState } from "./state";

const SCOPE = "live-bet-contract";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  acceptDialogs(page);
  e2eLogPage(page, SCOPE);
  await ensureLiveMode(page, SCOPE);
});

test("switch to live mode", async ({ page }) => {
  e2eLog(SCOPE, "step: switch to live mode");
  await assertLiveModeReady(page, SCOPE);
  e2eLog(SCOPE, "live mode confirmed");
});

test("place live bet in private group", async ({ page }) => {
  const state = loadE2eState();
  expect(state.userId).toBeTruthy();
  e2eLog(SCOPE, "step: place live bet", {
    groupId: state.groupId,
    marketId: state.marketId,
    userId: state.userId,
  });

  await assertLiveModeReady(page, SCOPE);
  await persistLiveModeStorage(page, SCOPE);
  await page.goto(`/group/${state.groupId}`);
  await page.waitForURL(new RegExp(`/group/${state.groupId}`), { timeout: 30_000 });
  e2eLog(SCOPE, "group page loaded", { url: page.url() });

  const crashBanner = page.getByText(/cannot add.*postgres_changes/i);
  if (await crashBanner.isVisible().catch(() => false)) {
    e2eLog(SCOPE, "GroupScreen crashed — realtime subscription error");
    throw new Error("GroupScreen crashed (realtime subscription). See browser.error logs above.");
  }

  await switchToLiveIfNeeded(page, SCOPE);

  await clickVisibleTestId(page, "group-tab-active", SCOPE);
  e2eLog(SCOPE, "Active bets tab selected");

  await page.getByText("Will E2E test pass today?").waitFor({ state: "visible", timeout: 60_000 });
  e2eLog(SCOPE, "market card loaded");
  await clickBetSideYes(page, SCOPE);
  e2eLog(SCOPE, "YES option clicked — bet sheet should open");

  await fillTextInput(page, "bet-amount", "10");
  await page.getByTestId("bet-place").click();

  await expect(page.getByText(/prediction placed|placed|agreement/i).first()).toBeVisible({
    timeout: 30_000,
  });
  e2eLog(SCOPE, "bet placed");
});

test("view wager agreement", async ({ page }) => {
  const state = loadE2eState();
  const userId = state.userId;
  expect(userId).toBeTruthy();
  e2eLog(SCOPE, "step: view contract", { userId, marketId: state.marketId });

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(
    process.env.SUPABASE_URL ?? "http://127.0.0.1:54321",
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  let betId: string | null = null;
  for (let i = 0; i < 16; i++) {
    const { data, error } = await admin
      .from("bets")
      .select("id")
      .eq("user_id", userId!)
      .eq("market_id", state.marketId)
      .order("placed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) e2eLog(SCOPE, "bets query error", { message: error.message });
    if (data?.id) {
      betId = data.id;
      break;
    }
    await page.waitForTimeout(500);
  }
  e2eLog(SCOPE, "bet lookup", { betId });
  expect(betId).toBeTruthy();

  saveE2eState({ ...state, lastBetId: betId! });
  await page.goto(`/contract/${betId}`);
  await expect(page.getByTestId("contract-root")).toBeVisible();
  await expect(page.getByText(/Wager Agreement/i)).toBeVisible();
  e2eLog(SCOPE, "contract page ok", { betId });
});

test("resolve market and verify settlement email chip", async ({ page }) => {
  const state = loadE2eState();
  expect(state.lastBetId).toBeTruthy();
  e2eLog(SCOPE, "step: resolve market", {
    marketId: state.marketId,
    lastBetId: state.lastBetId,
  });

  await resolveMarketAsAdmin(state.marketId, state.yesOptionId);
  e2eLog(SCOPE, "market resolved via admin RPC");

  await page.goto(`/contract/${state.lastBetId}`);
  await expect(page.getByTestId("contract-root")).toBeVisible();
  await expect(page.getByTestId("contract-email-resolved")).toContainText(/Sent|Pending/i, {
    timeout: 30_000,
  });
  e2eLog(SCOPE, "resolved email chip ok");
});
