import { expect, test } from "@playwright/test";
import { acceptDialogs, fillTextInput } from "./helpers/auth";
import { completeStripeCheckout } from "./helpers/stripe-checkout";
import { completeStripeIdentity } from "./helpers/stripe-identity";

/**
 * Optional Stripe iframe flows — skipped unless E2E_STRIPE_UI=1.
 * Critical bet/contract path uses API seed instead (see user-setup.spec.ts).
 */
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  test.skip(process.env.E2E_STRIPE_UI !== "1", "Set E2E_STRIPE_UI=1 to run Stripe UI tests");
  acceptDialogs(page);
  // Uses user-storage.json from user-setup — do not sign in as admin here.
});

test("Stripe Identity KYC", async ({ page, context }) => {
  await page.goto("/wallet/verify");
  await page.getByTestId("kyc-start").waitFor({ state: "visible", timeout: 30_000 });
  await completeStripeIdentity(page, context);
});

test("Stripe Checkout deposit", async ({ page }) => {
  await page.goto("/topup");
  await fillTextInput(page, "topup-amount", "10");
  await page.getByTestId("topup-submit").click();
  await completeStripeCheckout(page);
  await expect(page.getByText(/success|topped up|balance/i).first()).toBeVisible({
    timeout: 60_000,
  });
});
