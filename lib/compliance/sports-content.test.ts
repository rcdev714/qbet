import assert from "node:assert/strict";
import test from "node:test";
import { scanMarketTextForSports } from "./sports-content";

test("blocks explicit sports category", () => {
  const result = scanMarketTextForSports({ category: "sports" });
  assert.equal(result.blocked, true);
  assert.equal(result.reasonCode, "ec_sports_market_blocked");
});

test("detects Spanish sports question text", () => {
  const result = scanMarketTextForSports({
    question: "¿Gana el Barcelona el partido de hoy?",
    category: "general_event",
  });
  assert.equal(result.blocked, true);
  assert.equal(result.reasonCode, "ec_sports_content_detected");
});

test("detects English sports question text", () => {
  const result = scanMarketTextForSports({
    question: "Will the Lakers win the NBA Finals?",
  });
  assert.equal(result.blocked, true);
  assert.equal(result.reasonCode, "ec_sports_content_detected");
});

test("allows non-sports future events", () => {
  const result = scanMarketTextForSports({
    question: "Will inflation fall below 3% by December 2026?",
    description: "Resolved using official CPI release.",
  });
  assert.equal(result.blocked, false);
});
