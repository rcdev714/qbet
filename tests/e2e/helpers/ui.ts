import type { Page } from "@playwright/test";
import { e2eLog } from "./log";

/** Click the first visible element matching exact text (handles duplicate RN web trees). */
export async function clickVisibleText(
  page: Page,
  text: string,
  scope = "ui",
  exact = true,
) {
  const loc = page.getByText(text, { exact });
  const total = await loc.count();
  for (let index = 0; index < total; index++) {
    const el = loc.nth(index);
    if (await el.isVisible()) {
      e2eLog(scope, `click visible text="${text}"`, { index, total });
      await el.click();
      return;
    }
  }
  throw new Error(`No visible text="${text}" (${total} hidden)`);
}

/** Prefer testID; fall back to visible Yes/YES label when RN web tree lacks testIDs. */
export async function clickBetSideYes(page: Page, scope = "ui") {
  for (const label of ["Yes", "YES"]) {
    const loc = page.getByText(label, { exact: true });
    const total = await loc.count();
    for (let index = 0; index < total; index++) {
      const el = loc.nth(index);
      if (await el.isVisible()) {
        e2eLog(scope, `click visible bet side label="${label}"`, { index, total });
        await el.click();
        return;
      }
    }
  }

  const byId = page.getByTestId("bet-side-yes");
  if ((await byId.count()) > 0) {
    await clickVisibleTestId(page, "bet-side-yes", scope);
    return;
  }

  throw new Error("No visible Yes/YES option or bet-side-yes testID");
}

/** Click the first visible element matching a testID (handles duplicate RN web trees). */
export async function clickVisibleTestId(
  page: Page,
  testId: string,
  scope = "ui",
) {
  const loc = page.getByTestId(testId);
  const total = await loc.count();
  for (let index = 0; index < total; index++) {
    const el = loc.nth(index);
    if (await el.isVisible()) {
      e2eLog(scope, `click visible testId=${testId}`, { index, total });
      await el.click();
      return;
    }
  }
  throw new Error(`No visible element with testId=${testId} (${total} hidden)`);
}
