import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  coerceProfileTab,
  hiddenPublicSections,
  includeBetOnProfile,
  kycStatusLabelKey,
  legacyPublicSections,
  parseProfilePrivacy,
  profileMoneyVisible,
  profileSectionVisible,
  publicVerifiedBadge,
  resolveProfileSections,
  visibleProfileTabs,
} from "./profile-privacy";

const flags = {
  show_open_bets: false,
  show_results: true,
  show_activity_logs: false,
};

test("owner always sees settings, KYC, logs, open bets, and results", () => {
  for (const section of ["settings", "kyc_status", "activity_logs", "open_bets", "results"] as const) {
    assert.equal(profileSectionVisible({ isOwner: true, section, flags }), true);
  }
});

test("public profile hides each section whose toggle is off and never shows KYC or settings", () => {
  assert.equal(profileSectionVisible({ isOwner: false, section: "open_bets", flags }), false);
  assert.equal(profileSectionVisible({ isOwner: false, section: "results", flags }), true);
  assert.equal(profileSectionVisible({ isOwner: false, section: "activity_logs", flags }), false);
  assert.equal(profileSectionVisible({ isOwner: false, section: "settings", flags }), false);
  assert.equal(profileSectionVisible({ isOwner: false, section: "kyc_status", flags }), false);
});

test("verified badge requires the opt-in and a verified status", () => {
  assert.equal(publicVerifiedBadge({ showVerifiedBadge: true, kycStatus: "verified" }), true);
  assert.equal(publicVerifiedBadge({ showVerifiedBadge: false, kycStatus: "verified" }), false);
  assert.equal(publicVerifiedBadge({ showVerifiedBadge: true, kycStatus: "pending" }), false);
});

test("stranger privacy payload drops KYC status and raw settings", () => {
  const parsed = parseProfilePrivacy({
    is_owner: false,
    verified_badge: true,
    kyc_status: "verified",
    settings: { show_open_bets: false },
    sections: {
      settings: false,
      kyc_status: false,
      activity_logs: false,
      open_bets: false,
      results: true,
    },
  });
  assert.equal(parsed?.kycStatus, null);
  assert.equal(parsed?.settings, null);
  assert.equal(parsed?.verifiedBadge, true);
  assert.equal(parsed?.sections.results, true);
  assert.equal(parsed?.sections.open_bets, false);
  assert.equal(parsed?.sections.kyc_status, false);
});

test("strangers fail closed until privacy loads, and a missing RPC uses the legacy flag", () => {
  assert.deepEqual(
    resolveProfileSections({
      isOwner: false,
      privacy: null,
      missing: false,
      legacyActivityVisible: true,
    }),
    hiddenPublicSections(),
  );
  const legacy = resolveProfileSections({
    isOwner: false,
    privacy: null,
    missing: true,
    legacyActivityVisible: true,
  });
  assert.equal(legacy.open_bets, true);
  assert.equal(legacy.settings, false);
  assert.equal(legacy.kyc_status, false);
  const owner = resolveProfileSections({
    isOwner: true,
    privacy: null,
    missing: false,
    legacyActivityVisible: false,
  });
  assert.equal(owner.open_bets, true);
  assert.equal(owner.kyc_status, true);
});

test("a hidden section is omitted and its bets do not count as visible money", () => {
  const sections = {
    settings: false,
    kyc_status: false,
    activity_logs: true,
    open_bets: false,
    results: true,
  };
  assert.deepEqual(visibleProfileTabs(sections), ["activity", "stats", "groups", "closed"]);
  assert.equal(coerceProfileTab("open", visibleProfileTabs(sections)), "activity");
  assert.equal(includeBetOnProfile("open", sections), false);
  assert.equal(includeBetOnProfile("resolved", sections), true);
  assert.equal(profileMoneyVisible({ open_bets: false, results: false }), false);
});

test("KYC label is a status word", () => {
  assert.equal(kycStatusLabelKey("verified"), "statusVerified");
  assert.equal(kycStatusLabelKey("pending"), "statusPending");
  assert.equal(kycStatusLabelKey("not_started"), "statusNotVerified");
  assert.equal(kycStatusLabelKey(null), "statusNotVerified");
  assert.equal(kycStatusLabelKey("requires_review"), "statusNeedsReview");
});

test("en and es profile privacy copy stay in parity", () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../i18n/locales");
  for (const file of ["settings.json", "social.json"] as const) {
    const en = JSON.parse(readFileSync(path.join(root, "en", file), "utf8")) as Record<string, unknown>;
    const es = JSON.parse(readFileSync(path.join(root, "es", file), "utf8")) as Record<string, unknown>;
    assert.deepEqual(Object.keys(en).sort(), Object.keys(es).sort());
  }
  const enSettings = JSON.parse(
    readFileSync(path.join(root, "en", "settings.json"), "utf8"),
  ) as Record<string, string>;
  for (const key of [
    "showOpenBets",
    "showResults",
    "showActivityLogs",
    "showVerifiedBadge",
    "profileSectionPrivacyError",
    "statusNeedsReview",
    "kycStatusLabel",
  ]) {
    assert.equal(typeof enSettings[key], "string");
    assert.ok(enSettings[key].length > 0);
  }
});

test("legacy public sections follow one activity flag until the privacy RPC exists", () => {
  assert.deepEqual(legacyPublicSections(false), {
    settings: false,
    kyc_status: false,
    activity_logs: false,
    open_bets: false,
    results: false,
  });
});

test("migration keeps feed activity separate from profile sections", () => {
  const sql = readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../supabase/migrations/20260923190000_social_activity_sharing.sql",
    ),
    "utf8",
  );
  assert.match(sql, /show_open_bets boolean not null default true/);
  assert.match(sql, /show_results boolean not null default true/);
  assert.match(sql, /show_activity_logs boolean not null default true/);
  assert.match(sql, /show_verified_badge boolean not null default false/);
  assert.match(sql, /get_profile_privacy/);
  assert.match(sql, /set_profile_section_privacy/);
  assert.match(sql, /show_activity_logs from public.users/);
  assert.match(sql, /m\.status = 'open' and coalesce\(u\.show_open_bets, true\)/);
  assert.doesNotMatch(sql, /kyc_verification_sessions/);
});
