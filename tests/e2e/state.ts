import * as fs from "node:fs";
import * as path from "node:path";

const STATE_FILE = path.join(__dirname, ".runtime/e2e-state.json");

export type E2eState = {
  testEmail: string;
  testPassword: string;
  timestamp: number;
  adminEmail: string;
  groupId: string;
  marketId: string;
  yesOptionId: string;
  noOptionId: string;
  shareCode: string;
  userId?: string;
  lastBetId?: string;
};

export function loadE2eState(): E2eState {
  const raw = fs.readFileSync(STATE_FILE, "utf8");
  return JSON.parse(raw) as E2eState;
}

export function saveE2eState(state: E2eState) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function runtimePath(name: string) {
  return path.join(__dirname, ".runtime", name);
}
