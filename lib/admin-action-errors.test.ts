import assert from "node:assert/strict";
import test from "node:test";
import { formatActionError } from "./admin-action-errors";

test("formatActionError parses edge function body error", () => {
  const error = {
    message: "FunctionsHttpError",
    context: { body: JSON.stringify({ error: "RESEND_API_KEY is not configured" }) },
  };
  assert.equal(formatActionError(error), "RESEND_API_KEY is not configured");
});

test("formatActionError maps missing migration message", () => {
  const error = { message: "Could not find the function public.approve_beta_access_request" };
  assert.equal(
    formatActionError(error),
    "Beta access migrations are missing. Run: npx supabase migration up --local",
  );
});

test("formatActionError prefers details then message", () => {
  assert.equal(formatActionError({ message: "fail", details: "Admin only" }), "Admin only");
  assert.equal(formatActionError({ message: "Request not found" }), "Request not found");
});

test("formatActionError handles non-object input", () => {
  assert.equal(formatActionError(null), "Unknown error");
  assert.equal(formatActionError("oops"), "Unknown error");
});
