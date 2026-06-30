import {
    assertEquals,
    assertMatch
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
    buildApprovalEmailHtml,
    buildApprovalIdempotencyKey,
    buildWelcomeUrl,
} from "./beta-approval-email.ts";

Deno.test("buildWelcomeUrl strips trailing slash", () => {
  assertEquals(
    buildWelcomeUrl("https://anymarkt.com/", "69091d60-a3ec-485d-994c-a51073f4b624"),
    "https://anymarkt.com/beta/welcome?token=69091d60-a3ec-485d-994c-a51073f4b624",
  );
});

Deno.test("buildApprovalIdempotencyKey is stable for first send", () => {
  assertEquals(
    buildApprovalIdempotencyKey("req-123", false),
    "beta-approval/req-123",
  );
});

Deno.test("buildApprovalIdempotencyKey varies on forceResend", () => {
  const key = buildApprovalIdempotencyKey("req-123", true);
  assertMatch(key, /^beta-approval\/req-123\/resend-\d+$/);
});

Deno.test("buildApprovalEmailHtml includes greeting and welcome link", () => {
  const html = buildApprovalEmailHtml({
    fullName: "Sebastian",
    welcomeUrl: "https://anymarkt.com/beta/welcome?token=abc",
  });
  assertMatch(html, /Hi Sebastian,/);
  assertMatch(html, /https:\/\/anymarkt\.com\/beta\/welcome\?token=abc/);
  assertMatch(html, /Continue to Anymarkt/);
});

Deno.test("buildApprovalEmailHtml uses generic greeting when name missing", () => {
  const html = buildApprovalEmailHtml({
    fullName: null,
    welcomeUrl: "https://anymarkt.com/beta/welcome?token=abc",
  });
  assertMatch(html, /Hi there,/);
});
