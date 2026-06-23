import assert from "node:assert/strict";
import test from "node:test";
import {
    BetaAccessAlreadySubmittedError,
    formatBetaAccessSubmitError,
    parseApprovalTokenResponse,
} from "./betaAccess.parsers";

test("formatBetaAccessSubmitError maps ALREADY_SUBMITTED", () => {
  assert.equal(
    formatBetaAccessSubmitError(new BetaAccessAlreadySubmittedError()),
    "ALREADY_SUBMITTED",
  );
});

test("formatBetaAccessSubmitError maps missing migration", () => {
  assert.equal(
    formatBetaAccessSubmitError({ message: "Could not find the function public.submit_beta_access_request" }),
    "Beta access is not configured yet. Run: npx supabase migration up --local",
  );
});

test("formatBetaAccessSubmitError maps country unavailable", () => {
  assert.equal(
    formatBetaAccessSubmitError({ message: "Country is not available for launch" }),
    "That country is not available for the current beta.",
  );
});

test("formatBetaAccessSubmitError maps invalid email", () => {
  assert.equal(
    formatBetaAccessSubmitError({ message: "Invalid email address" }),
    "Please enter a valid email address.",
  );
});

test("formatBetaAccessSubmitError prefers details", () => {
  assert.equal(
    formatBetaAccessSubmitError({ message: "Error", details: "Detail message" }),
    "Detail message",
  );
});

test("parseApprovalTokenResponse handles array RPC result", () => {
  const row = {
    email: "user@example.com",
    status: "approved",
    full_name: "Test",
    country_code: "EC",
    request_id: "req-1",
  };
  assert.deepEqual(parseApprovalTokenResponse([row]), row);
});

test("parseApprovalTokenResponse handles single object", () => {
  const row = {
    email: "user@example.com",
    status: "approved",
    full_name: null,
    country_code: "EC",
    request_id: "req-2",
  };
  assert.deepEqual(parseApprovalTokenResponse(row), row);
});

test("parseApprovalTokenResponse returns null for empty array", () => {
  assert.equal(parseApprovalTokenResponse([]), null);
});

test("parseApprovalTokenResponse returns null for null", () => {
  assert.equal(parseApprovalTokenResponse(null), null);
});
