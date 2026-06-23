import { test as setup } from "@playwright/test";
import { signIn } from "./helpers/auth";
import { adminCredentials } from "./helpers/credentials";
import { loadE2eState, runtimePath } from "./state";

setup("authenticate admin", async ({ page }) => {
  const { email, password } = adminCredentials();
  const state = loadE2eState();
  if (state.adminEmail !== email) {
    throw new Error(`adminEmail mismatch: state=${state.adminEmail}`);
  }

  await signIn(page, email, password);
  await page.goto("/admin/users");
  await page.waitForURL(/\/admin\/users/, { timeout: 60_000 });

  await page.context().storageState({ path: runtimePath("admin-storage.json") });
});
