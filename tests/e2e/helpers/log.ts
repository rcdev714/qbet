/** Structured console output for E2E debugging in the terminal. */
export function e2eLog(scope: string, step: string, detail?: Record<string, unknown>) {
  const prefix = `[e2e:${scope}]`;
  if (detail && Object.keys(detail).length > 0) {
    console.log(`${prefix} ${step}`, detail);
  } else {
    console.log(`${prefix} ${step}`);
  }
}

export function e2eLogPage(page: import("@playwright/test").Page, scope: string) {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      e2eLog(scope, "browser.error", { text: msg.text() });
    }
  });
  page.on("pageerror", (err) => {
    e2eLog(scope, "page.error", { message: err.message });
  });
}
