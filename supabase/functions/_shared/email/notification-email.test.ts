import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
    shouldSendEmailForType,
    shouldSendPushForType,
} from "./notification-email.ts";
import { buildNewFollowerEmail } from "./templates/new-follower.ts";
import { buildWelcomeEmail } from "./templates/welcome.ts";

Deno.test("buildWelcomeEmail includes brand and CTA", () => {
  const result = buildWelcomeEmail({ username: "alice", appUrl: "https://app.example.com" });
  assertEquals(result.subject, "Welcome to AnyMarket");
  assertEquals(result.html.includes("AnyMarket"), true);
  assertEquals(result.html.includes("https://app.example.com"), true);
});

Deno.test("buildNewFollowerEmail uses follower username", () => {
  const result = buildNewFollowerEmail({
    followerUsername: "bob",
    profileUrl: "https://app.example.com/profile/1",
    appUrl: "https://app.example.com",
    notificationId: "n-1",
  });
  assertEquals(result.subject.includes("@bob"), true);
});

Deno.test("shouldSendEmailForType respects preferences", () => {
  const prefs = {
    email_enabled: true,
    email_market_results: false,
    email_social: true,
  };
  assertEquals(shouldSendEmailForType("bet_won", prefs), false);
  assertEquals(shouldSendEmailForType("new_follower", prefs), true);
  assertEquals(shouldSendEmailForType("bet_won", { ...prefs, email_enabled: false }), false);
});

Deno.test("shouldSendPushForType respects preferences", () => {
  const prefs = {
    push_web_enabled: true,
    push_market_results: true,
    push_social: false,
  };
  assertEquals(shouldSendPushForType("new_follower", prefs), false);
  assertEquals(shouldSendPushForType("bet_lost", prefs), true);
});
