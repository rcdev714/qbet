import assert from "node:assert/strict";
import test from "node:test";
import { formatDiagnosisForDebug } from "./bet-contract-diagnostics";

test("formatDiagnosisForDebug returns JSON string", () => {
  const text = formatDiagnosisForDebug({
    reason: "practice_mode",
    title: "Practice mode bet",
    message: "No contract for practice bets.",
    canRetry: false,
  });
  assert.match(text, /practice_mode/);
  assert.match(text, /Practice mode bet/);
});
