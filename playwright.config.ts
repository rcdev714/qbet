import { defineConfig, devices } from "@playwright/test";
import { runtimePath } from "./tests/e2e/state";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8081",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  projects: [
    {
      name: "admin-setup",
      testMatch: /admin-setup\.spec\.ts/,
    },
    {
      name: "beta-flow",
      testMatch: /beta-flow\.spec\.ts/,
      dependencies: ["admin-setup"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "user-setup",
      testMatch: /user-setup\.spec\.ts/,
      dependencies: ["beta-flow"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "live-bet-contract",
      testMatch: /live-bet-contract\.spec\.ts/,
      dependencies: ["user-setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: runtimePath("user-storage.json"),
      },
    },
    {
      name: "stripe-flow",
      testMatch: /stripe-flow\.spec\.ts/,
      dependencies: ["user-setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: runtimePath("user-storage.json"),
      },
    },
    {
      name: "feed-suggestions",
      testMatch: /feed-suggestions\.spec\.ts/,
      dependencies: ["admin-setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: runtimePath("admin-storage.json"),
      },
    },
  ],
});
