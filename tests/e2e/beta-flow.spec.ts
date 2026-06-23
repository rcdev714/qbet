import { test } from "@playwright/test";
import { approveBetaRequest, submitBetaAccessRequest } from "./helpers/admin-beta";
import { loadE2eState, runtimePath } from "./state";

test.describe.configure({ mode: "serial" });

test("submit beta access request", async ({ page }) => {
  const state = loadE2eState();
  await submitBetaAccessRequest(page, state.testEmail);
});

test("admin approves beta request", async ({ browser }) => {
  const state = loadE2eState();
  const adminContext = await browser.newContext({
    storageState: runtimePath("admin-storage.json"),
  });
  const adminPage = await adminContext.newPage();
  adminPage.on("dialog", async (dialog) => dialog.accept());
  await approveBetaRequest(adminPage, state.testEmail);
  await adminContext.close();
});
