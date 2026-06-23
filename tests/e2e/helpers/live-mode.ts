import type { Page } from "@playwright/test";
import { e2eLog } from "./log";

const PLAY_MODE_KEY = "@qbet_play_mode";

function liveModeHeader(page: Page) {
  return page.getByRole("button", {
    name: /live balance|live mode|modo live|saldo live/i,
  });
}

function practiceModeHeader(page: Page) {
  return page.getByRole("button", {
    name: /practice mode|modo práctica|modo practice/i,
  });
}

/** Persist live mode in browser storage (AsyncStorage on web uses localStorage). */
export async function persistLiveModeStorage(page: Page, scope = "live-mode") {
  await page.evaluate((key) => {
    try {
      localStorage.setItem(key, "false");
    } catch {
      // ignore
    }
  }, PLAY_MODE_KEY);
  e2eLog(scope, "persisted live mode in localStorage");
}

/** Persist live mode before app reads AsyncStorage/localStorage on load. */
export async function ensureLiveMode(page: Page, scope = "live-mode") {
  e2eLog(scope, "ensureLiveMode: set localStorage", { key: PLAY_MODE_KEY, value: "false" });
  await page.addInitScript((key) => {
    try {
      localStorage.setItem(key, "false");
    } catch {
      // ignore
    }
  }, PLAY_MODE_KEY);
}

export async function switchToLiveIfNeeded(page: Page, scope = "live-mode") {
  for (let attempt = 1; attempt <= 6; attempt++) {
    if (await liveModeHeader(page).isVisible().catch(() => false)) {
      e2eLog(scope, "live mode active on current page", { attempt, url: page.url() });
      return;
    }

    const practice = practiceModeHeader(page);
    if (await practice.isVisible().catch(() => false)) {
      e2eLog(scope, "practice detected — opening switch modal", { attempt });
      await practice.click();
      const switchBtn = page.getByTestId("mode-switch-to-live");
      await switchBtn.waitFor({ state: "visible", timeout: 10_000 });
      await switchBtn.click();
      await page.waitForTimeout(1500);
      continue;
    }

    e2eLog(scope, "waiting for mode header", { attempt, url: page.url() });
    await page.waitForTimeout(1000);
  }

  const onVerify = page.url().includes("/wallet/verify");
  if (onVerify) {
    e2eLog(scope, "redirected to wallet verify — live wallet gate blocked switch", {
      url: page.url(),
    });
  }

  await liveModeHeader(page).waitFor({ state: "visible", timeout: 15_000 });
  e2eLog(scope, "live mode active on current page", { url: page.url() });
}

export async function assertLiveModeReady(page: Page, scope = "live-mode") {
  await page.goto("/wallet");
  await page.waitForURL(/\/wallet/, { timeout: 30_000 });
  await switchToLiveIfNeeded(page, scope);
  await persistLiveModeStorage(page, scope);
}
