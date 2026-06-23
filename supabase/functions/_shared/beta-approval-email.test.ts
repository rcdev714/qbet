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
    buildWelcomeUrl("https://anymarket.expo.app/", "69091d60-a3ec-485d-994c-a51073f4b624"),
    "https://anymarket.expo.app/beta/welcome?token=69091d60-a3ec-485d-994c-a51073f4b624",
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
    welcomeUrl: "https://anymarket.expo.app/beta/welcome?token=abc",
  });
  assertMatch(html, /Hi Sebastian,/);
  assertMatch(html, /https:\/\/anymarket\.expo\.app\/beta\/welcome\?token=abc/);
  assertMatch(html, /Continue to AnyMarket/);
});

Deno.test("buildApprovalEmailHtml uses generic greeting when name missing", () => {
  const html = buildApprovalEmailHtml({
    fullName: null,
    welcomeUrl: "https://anymarket.expo.app/beta/welcome?token=abc",
  });
  assertMatch(html, /Hi there,/);
});
