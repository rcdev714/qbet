import type { Page } from "@playwright/test";
import { assertLiveModeReady } from "./live-mode";

export function acceptDialogs(page: Page) {
  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });
}

/** React Native Web TextInputs need keystrokes to update controlled state. */
export async function fillTextInput(page: Page, testId: string, value: string) {
  const input = page.getByTestId(testId);
  await input.click();
  await input.fill("");
  await input.pressSequentially(value, { delay: 10 });
}

export async function signUp(page: Page, email: string, password: string) {
  acceptDialogs(page);
  await page.goto("/login?mode=signup");
  await fillTextInput(page, "login-email", email);
  await fillTextInput(page, "login-password", password);
  const confirm = page.getByTestId("login-confirm-password");
  if (await confirm.isVisible().catch(() => false)) {
    await fillTextInput(page, "login-confirm-password", password);
  }
  await page.getByTestId("login-submit").click();
  await page.waitForURL(/\/(onboarding|tabs|feed)/, { timeout: 60_000 });
}

export async function signIn(page: Page, email: string, password: string) {
  acceptDialogs(page);
  await page.goto("/login");
  await fillTextInput(page, "login-email", email);
  await fillTextInput(page, "login-password", password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 60_000 });
}

export async function completeResidenceOnboarding(page: Page) {
  await page.goto("/onboarding/residence");
  await page.getByTestId("country-option-EC").click();
  await page.getByTestId("residence-continue").click();
  await page.waitForURL(/\/onboarding\/policies/, { timeout: 30_000 });
}

export async function completePoliciesOnboarding(page: Page) {
  await page.goto("/onboarding/policies");
  await page.getByTestId("policies-age-checkbox").click();
  await page.getByTestId("policies-consent-checkbox").click();
  await page.getByTestId("policies-continue").click();
  await page.waitForURL(/\/(tabs|feed)/, { timeout: 60_000 });
}

export async function switchToLiveMode(page: Page) {
  await assertLiveModeReady(page, "auth");
}
