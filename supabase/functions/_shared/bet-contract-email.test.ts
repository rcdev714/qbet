import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
    buildBetContractEmailHtml,
    buildBetContractIdempotencyKey,
    buildBetContractSubject,
} from "./bet-contract-email.ts";

Deno.test("buildBetContractIdempotencyKey is stable", () => {
  assertEquals(
    buildBetContractIdempotencyKey("abc", "placed"),
    "bet-contract/abc/placed",
  );
});

Deno.test("buildBetContractSubject for placed event", () => {
  const subject = buildBetContractSubject({
    eventType: "placed",
    marketQuestion: "Will the demo ship?",
  });
  assertEquals(subject.includes("wager agreement"), true);
});

Deno.test("buildBetContractSubject for resolved event", () => {
  const subject = buildBetContractSubject({
    eventType: "resolved",
    marketQuestion: "Will the demo ship?",
    outcome: "won",
  });
  assertEquals(subject.includes("WON"), true);
});

Deno.test("buildBetContractEmailHtml includes contract link", () => {
  const html = buildBetContractEmailHtml({
    contractNumber: "QBET-20260627-ABC",
    marketQuestion: "Will the demo ship?",
    stakeLabel: "$25.00",
    eventType: "placed",
    contractUrl: "https://anymarkt.com/contract/123",
  });
  assertEquals(html.includes("View Wager Agreement"), true);
  assertEquals(html.includes("QBET-20260627-ABC"), true);
});
