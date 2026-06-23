import assert from "node:assert/strict";
import test from "node:test";
import {
    normalizeBetaAccessIntent,
    parseBetaAccessIntentRaw,
} from "./beta-access-intent-core";

test("parseBetaAccessIntentRaw accepts valid submitted intent", () => {
  const raw = JSON.stringify({
    email: "User@Example.com",
    status: "submitted",
    requestId: "abc-123",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  const parsed = parseBetaAccessIntentRaw(raw);
  assert.equal(parsed?.email, "User@Example.com");
  assert.equal(parsed?.status, "submitted");
  assert.equal(parsed?.requestId, "abc-123");
});

test("parseBetaAccessIntentRaw accepts valid approved intent", () => {
  const raw = JSON.stringify({
    email: "user@example.com",
    status: "approved",
    approvalToken: "token-uuid",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  const parsed = parseBetaAccessIntentRaw(raw);
  assert.equal(parsed?.status, "approved");
  assert.equal(parsed?.approvalToken, "token-uuid");
});

test("parseBetaAccessIntentRaw rejects missing email or status", () => {
  assert.equal(parseBetaAccessIntentRaw(JSON.stringify({ status: "submitted" })), null);
  assert.equal(parseBetaAccessIntentRaw(JSON.stringify({ email: "a@b.com" })), null);
  assert.equal(parseBetaAccessIntentRaw(null), null);
});

test("parseBetaAccessIntentRaw rejects invalid status", () => {
  const raw = JSON.stringify({ email: "a@b.com", status: "pending" });
  assert.equal(parseBetaAccessIntentRaw(raw), null);
});

test("parseBetaAccessIntentRaw rejects corrupt JSON", () => {
  assert.equal(parseBetaAccessIntentRaw("{not-json"), null);
});

test("normalizeBetaAccessIntent lowercases email", () => {
  const normalized = normalizeBetaAccessIntent({
    email: "  User@Example.COM  ",
    status: "submitted",
  });
  assert.equal(normalized.email, "user@example.com");
  assert.ok(normalized.updatedAt);
});
