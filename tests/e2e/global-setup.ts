import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const RUNTIME_DIR = path.join(ROOT, "tests/e2e/.runtime");
const STATE_FILE = path.join(RUNTIME_DIR, "e2e-state.json");

export default async function globalSetup() {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });

  execSync("npx tsx scripts/seed-e2e-fixtures.ts", {
    cwd: ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      E2E_API_SETUP: "0",
    },
  });

  if (!fs.existsSync(STATE_FILE)) {
    throw new Error(`Missing ${STATE_FILE} after global setup`);
  }

  const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:8081";
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(baseUrl);
      if (res.ok || res.status === 200) {
        ready = true;
        break;
      }
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (!ready) {
    throw new Error(`App not reachable at ${baseUrl} — start with npm run web`);
  }
}
