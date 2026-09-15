import { expect, test } from "@playwright/test";

test("shows blocking loader on protected deep link while auth resolves", async ({ page }) => {
  await page.goto("/discover");

  await expect(page.getByText("Preparing Anymarkt...")).toBeVisible();
  await expect(page.getByText("Preparing Anymarkt...")).toBeHidden({ timeout: 15_000 });
});
