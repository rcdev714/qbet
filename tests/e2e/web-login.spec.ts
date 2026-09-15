import { expect, test } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "juan.salgador@uisek.edu.ec";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "E2eAdmin!Test1";

test.describe("web login", () => {
  test("shows inline error for wrong password", async ({ page }) => {
    await page.goto("/login");

    await page.getByTestId("login-email").fill(ADMIN_EMAIL);
    await page.getByTestId("login-password").fill("definitely-wrong-password");
    await page.getByTestId("login-submit").click();

    const error = page.getByTestId("login-error");
    await expect(error).toBeVisible();
    await expect(error).toContainText(/incorrect|incorrectos|reset-local-admin-password/i);
  });

  test("admin can sign in locally", async ({ page }) => {
    await page.goto("/login");

    await page.getByTestId("login-email").fill(ADMIN_EMAIL);
    await page.getByTestId("login-password").fill(ADMIN_PASSWORD);
    await page.getByTestId("login-submit").click();

    await expect(page.getByTestId("login-error")).toHaveCount(0);
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  });
});
