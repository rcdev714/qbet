import type { Page } from "@playwright/test";

export async function completeStripeCheckout(page: Page) {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 });

  const cardFrame = page.frameLocator('iframe[name*="card"], iframe[title*="card"]').first();
  const hasFrame = await cardFrame.locator('input[name="cardnumber"]').isVisible({ timeout: 5000 }).catch(() => false);

  if (hasFrame) {
    await cardFrame.locator('input[name="cardnumber"]').fill("4242424242424242");
    await cardFrame.locator('input[name="exp-date"]').fill("1234");
    await cardFrame.locator('input[name="cvc"]').fill("123");
  } else {
    await page.locator('input[name="cardNumber"], input[autocomplete="cc-number"]').first().fill("4242424242424242");
    await page.locator('input[name="cardExpiry"], input[autocomplete="cc-exp"]').first().fill("1234");
    await page.locator('input[name="cardCvc"], input[autocomplete="cc-csc"]').first().fill("123");
  }

  const payButton = page.getByRole("button", { name: /pay|submit|complete/i });
  await payButton.click();

  await page.waitForURL(/localhost:8081.*topup|success=true/, { timeout: 120_000 });
}
