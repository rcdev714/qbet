import { expect, test } from "@playwright/test";
import { runtimePath } from "./state";

test.describe("Wallet payout setup UI", () => {
  test.use({
    storageState: runtimePath("user-storage.json"),
    viewport: { width: 1280, height: 900 },
  });

  test("desktop wallet shows payout setup panel and form for live user", async ({
    page,
  }) => {
    await page.goto("/wallet");
    await page.waitForLoadState("networkidle");

    const setupPanel = page.getByTestId("wallet-payout-setup-panel");
    const payoutForm = page.getByTestId("wallet-payout-form");

    await expect(setupPanel.or(payoutForm).first()).toBeVisible({
      timeout: 30_000,
    });

    if (await setupPanel.isVisible()) {
      await expect(setupPanel.getByText(/Payout setup|Configuración de pagos/i)).toBeVisible();
    }

    if (await payoutForm.isVisible()) {
      await expect(page.getByTestId("payout-first-name")).toBeVisible();
      await expect(page.getByTestId("wallet-bank-picker")).toBeVisible();
      await expect(page.getByTestId("payout-account-number")).toBeVisible();
      await expect(page.getByTestId("payout-save-continue")).toBeVisible();
    }
  });

  test("wallet action rail remains usable on desktop", async ({ page }) => {
    await page.goto("/wallet");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Add Funds").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Withdraw").first()).toBeVisible();
  });
});
