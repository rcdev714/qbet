import test from "node:test";
import assert from "node:assert/strict";

import { formatIncomingReleaseDate } from "./payout-hold-constants";

test("formatIncomingReleaseDate formats valid ISO dates", () => {
  const formatted = formatIncomingReleaseDate("2026-07-04T12:00:00.000Z", "en-US");
  assert.match(formatted, /Jul/);
  assert.match(formatted, /4/);
});

test("formatIncomingReleaseDate returns empty for invalid input", () => {
  assert.equal(formatIncomingReleaseDate("not-a-date"), "");
});
