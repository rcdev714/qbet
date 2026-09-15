import { expect, test } from "@playwright/test";

import { loadE2eState } from "./state";

test.describe("Groups split view", () => {
  test("desktop shows list and detail panes when a group is selected", async ({ page }) => {
    const state = loadE2eState();
    test.skip(!state.groupId, "Requires seeded group from user-setup");

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/groups");

    await expect(page.getByTestId("groups-split-layout")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("groups-list-pane")).toBeVisible();
    await expect(page.getByTestId("groups-detail-placeholder")).toBeVisible();

    await page.getByRole("button", { name: /Open group/i }).first().click();

    await expect(page.getByTestId("groups-detail-placeholder")).toBeHidden({ timeout: 15_000 });
    await expect(page.getByTestId("groups-list-pane")).toBeVisible();
    await expect(page.getByTestId("groups-detail-pane")).toBeVisible();
  });

  test("mobile keeps stack navigation to full-screen group chat", async ({ page }) => {
    const state = loadE2eState();
    test.skip(!state.groupId, "Requires seeded group from user-setup");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/groups");

    await expect(page.getByTestId("groups-split-layout")).toBeHidden({ timeout: 15_000 });
    await page.getByRole("button", { name: /Open group/i }).first().click();

    await page.waitForURL(/\/groups\/[^/]+/, { timeout: 30_000 });
    await expect(page.getByText("Chat", { exact: false })).toBeVisible({ timeout: 15_000 });
  });
});
