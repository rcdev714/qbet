import { expect, test as setup } from "@playwright/test";
import { getUserIdByEmail } from "./helpers/assert-db";
import {
    completePoliciesOnboarding,
    completeResidenceOnboarding,
    signUp,
} from "./helpers/auth";
import { testUserCredentials } from "./helpers/credentials";
import { enableLiveWalletForUser } from "./helpers/seed-user";
import { loadE2eState, runtimePath, saveE2eState } from "./state";

setup("sign up, onboard, and save session", async ({ page }) => {
  const state = loadE2eState();
  const { email, password } = testUserCredentials();
  expect(email).toBe(state.testEmail);
  expect(email).not.toBe(state.adminEmail);

  page.on("dialog", async (dialog) => dialog.accept());

  await signUp(page, email, password);
  await completeResidenceOnboarding(page);
  await completePoliciesOnboarding(page);

  const userId = await getUserIdByEmail(email);
  expect(userId).toBeTruthy();
  if (!userId) return;

  // Bypass Stripe Identity + Checkout — not critical for contract/bet UI path.
  await enableLiveWalletForUser(userId, state.groupId);
  saveE2eState({ ...state, userId });

  await page.context().storageState({ path: runtimePath("user-storage.json") });
});
