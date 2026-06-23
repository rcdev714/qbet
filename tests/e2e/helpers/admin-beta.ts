import type { Page } from "@playwright/test";
import { fillTextInput } from "./auth";

export async function approveBetaRequest(page: Page, testEmail: string) {
  await page.goto("/admin/users");
  await page.waitForURL(/\/admin\/users/, { timeout: 60_000 });
  await page.waitForLoadState("networkidle");

  const requestTestId = `beta-request-${testEmail.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
  await page.getByTestId(`${requestTestId}-approve`).click();

  await page.getByText(/approved|aprobad|email sent|correo|success|éxito/i).first().waitFor({
    state: "visible",
    timeout: 30_000,
  });
}

export async function submitBetaAccessRequest(
  page: Page,
  email: string,
  fullName = "E2E Test User",
) {
  await page.goto("/request-access");
  await fillTextInput(page, "access-email", email);
  await fillTextInput(page, "access-name", fullName);
  await page.getByTestId("country-option-EC").click();
  await page.getByTestId("access-submit").click();
  await page.getByText(/request received|success|thank/i).first().waitFor({
    state: "visible",
    timeout: 30_000,
  });
}
