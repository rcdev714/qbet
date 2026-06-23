import type { BrowserContext, Page } from "@playwright/test";

export async function completeStripeIdentity(page: Page, context: BrowserContext) {
  const popupPromise = context.waitForEvent("page", { timeout: 15_000 }).catch(() => null);

  await page.getByTestId("kyc-start").click();

  const popup = await popupPromise;
  const identityPage = popup ?? page;

  await identityPage.waitForURL(/verify\.stripe\.com|stripe\.com.*identity/, {
    timeout: 60_000,
  });

  // Stripe Identity test mode — use test document flow when available
  const continueBtn = identityPage.getByRole("button", { name: /continue|start|verify/i }).first();
  if (await continueBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await continueBtn.click();
  }

  const testModeLink = identityPage.getByText(/test mode|use test/i).first();
  if (await testModeLink.isVisible({ timeout: 8000 }).catch(() => false)) {
    await testModeLink.click();
  }

  const successBtn = identityPage.getByRole("button", { name: /complete|submit|done|continue/i }).last();
  if (await successBtn.isVisible({ timeout: 30_000 }).catch(() => false)) {
    await successBtn.click();
  }

  if (popup) {
    await popup.waitForEvent("close", { timeout: 120_000 }).catch(() => undefined);
  }

  await page.waitForURL(/\/wallet\/verify/, { timeout: 120_000 });

  const pollBtn = page.getByTestId("kyc-poll-status");
  if (await pollBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    for (let i = 0; i < 12; i++) {
      await pollBtn.click();
      await page.waitForTimeout(3000);
      if (await page.getByText(/verified|success|live wallet/i).isVisible().catch(() => false)) {
        break;
      }
    }
  }

  await page.waitForURL(/\/(tabs)\/wallet|wallet\/verify/, { timeout: 120_000 });
}
