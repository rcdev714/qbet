import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
    buildBetContractAttachmentFilename,
    formatContractMoney,
} from "../bet-contract-document.ts";
import { buildBetContractEmailHtml } from "../bet-contract-email.ts";
import { stringToBase64 } from "../bet-contract-pdf.ts";
import {
    isDigestEligibleType,
    shouldSendEmailForType,
    shouldSendPushForType,
} from "./notification-email.ts";
import { buildNewFollowerEmail } from "./templates/new-follower.ts";
import { buildWelcomeEmail } from "./templates/welcome.ts";

Deno.test("buildWelcomeEmail includes brand and CTA", () => {
  const result = buildWelcomeEmail({ username: "alice", appUrl: "https://app.example.com" });
  assertEquals(result.subject, "Welcome to Anymarkt");
  assertEquals(result.html.includes("Anymarkt"), true);
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

Deno.test("shouldSendEmailForType respects preferences including group invites", () => {
  const prefs = {
    email_enabled: true,
    email_market_results: false,
    email_social: true,
    email_group_invites: false,
  };
  assertEquals(shouldSendEmailForType("bet_won", prefs), false);
  assertEquals(shouldSendEmailForType("new_follower", prefs), true);
  assertEquals(shouldSendEmailForType("group_invite", prefs), false);
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

Deno.test("isDigestEligibleType covers social low-priority events", () => {
  assertEquals(isDigestEligibleType("new_follower"), true);
  assertEquals(isDigestEligibleType("group_invite_accepted"), true);
  assertEquals(isDigestEligibleType("group_invite"), false);
});

Deno.test("buildBetContractEmailHtml mentions attachment when present", () => {
  const html = buildBetContractEmailHtml({
    contractNumber: "AM-001",
    marketQuestion: "Will it rain?",
    stakeLabel: "$10.00",
    eventType: "placed",
    contractUrl: "https://app.example.com/contract/1",
    appUrl: "https://app.example.com",
    hasAttachment: true,
  });
  assertEquals(html.includes("attached"), true);
  assertEquals(html.includes("/settings/notifications"), true);
});

Deno.test("buildBetContractAttachmentFilename is safe", () => {
  assertEquals(
    buildBetContractAttachmentFilename("AM/001", "placed", "pdf"),
    "Anymarkt-Wager-AM-001-placed.pdf",
  );
});

Deno.test("stringToBase64 encodes html receipts", () => {
  const encoded = stringToBase64("<html>receipt</html>");
  assertEquals(encoded.length > 0, true);
});

Deno.test("formatContractMoney formats USD", () => {
  assertEquals(formatContractMoney(10.5, "USD").includes("10"), true);
});
