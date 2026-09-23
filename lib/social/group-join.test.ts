import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  canContinueCreateStep,
  classifyJoinError,
  groupAvatarExtension,
  normalizeInviteCode,
  parseGroupCodePreview,
  previousCreateStep,
  privacyColumns,
  resolveJoinCard,
  type GroupCodePreview,
} from "./group-join";

const preview: GroupCodePreview = {
  groupId: "group-1",
  name: "Sunday football",
  description: "Weekly picks",
  avatarUrl: null,
  memberCount: 4,
  isMember: false,
  isDiscoverable: true,
};

test("invite codes are 6 uppercase characters", () => {
  assert.equal(normalizeInviteCode(" ab-c12 "), "ABC12");
  assert.equal(normalizeInviteCode("abc123xyz"), "ABC123");
});

test("create steps ask for a name and an explicit privacy choice", () => {
  assert.equal(canContinueCreateStep("name", { name: "  ", privacy: null }), false);
  assert.equal(canContinueCreateStep("name", { name: "Crew", privacy: null }), true);
  assert.equal(canContinueCreateStep("photo", { name: "Crew", privacy: null }), true);
  assert.equal(canContinueCreateStep("privacy", { name: "Crew", privacy: null }), false);
  assert.equal(canContinueCreateStep("privacy", { name: "Crew", privacy: "invite" }), true);
  assert.equal(canContinueCreateStep("about", { name: "Crew", privacy: "profile" }), true);
  assert.equal(previousCreateStep("name"), null);
  assert.equal(previousCreateStep("about"), "privacy");
});

test("privacy choices map onto discoverable and profile flags", () => {
  assert.deepEqual(privacyColumns("profile"), { isDiscoverable: true, showOnProfile: true });
  assert.deepEqual(privacyColumns("invite"), { isDiscoverable: false, showOnProfile: false });
});

test("preview rows keep public fields and drop the invite code", () => {
  const parsed = parseGroupCodePreview({
    group_id: "group-1",
    name: " Sunday football ",
    description: "  ",
    avatar_url: "https://cdn.example/a.png",
    member_count: "8",
    is_member: false,
    is_discoverable: true,
    share_code: "ABC123",
  });
  assert.deepEqual(parsed, {
    groupId: "group-1",
    name: "Sunday football",
    description: null,
    avatarUrl: "https://cdn.example/a.png",
    memberCount: 8,
    isMember: false,
    isDiscoverable: true,
  });
  assert.equal(parsed && "share_code" in parsed, false);
  assert.equal(parseGroupCodePreview({ group_id: "x" }), null);
});

test("join card distinguishes pending, invalid, already in, and a joinable preview", () => {
  assert.equal(resolveJoinCard({ code: "ABC", pending: true, missingRpc: false, errorMessage: null, preview: null }).kind, "idle");
  assert.equal(
    resolveJoinCard({ code: "ABC123", pending: true, missingRpc: false, errorMessage: "Group not found", preview: null }).kind,
    "pending",
  );
  assert.equal(
    resolveJoinCard({ code: "ABC123", pending: false, missingRpc: false, errorMessage: null, preview: null }).kind,
    "invalid",
  );
  assert.equal(
    resolveJoinCard({ code: "ABC123", pending: false, missingRpc: false, errorMessage: "Group not found", preview: null }).kind,
    "invalid",
  );
  assert.equal(
    resolveJoinCard({ code: "ABC123", pending: false, missingRpc: false, errorMessage: "network down", preview: null }).kind,
    "lookup-failed",
  );
  assert.equal(
    resolveJoinCard({ code: "ABC123", pending: false, missingRpc: true, errorMessage: null, preview: null }).kind,
    "preview-unavailable",
  );
  assert.equal(
    resolveJoinCard({ code: "ABC123", pending: false, missingRpc: false, errorMessage: null, preview }).kind,
    "ready",
  );
  const already = resolveJoinCard({
    code: "ABC123",
    pending: false,
    missingRpc: false,
    errorMessage: null,
    preview: { ...preview, isMember: true },
  });
  assert.equal(already.kind, "already-in");
  assert.equal(classifyJoinError("Group not found"), "invalid");
  assert.equal(classifyJoinError("permission denied"), "failed");
});

test("group photo extensions stay inside the avatar bucket types", () => {
  assert.equal(groupAvatarExtension("file:///a.PNG", null), "png");
  assert.equal(groupAvatarExtension("file:///a", "image/jpeg"), "jpg");
  assert.equal(groupAvatarExtension("file:///a.bin", "application/octet-stream"), "jpg");
});

test("english and spanish group sheet copy stay in parity", () => {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../i18n/locales");
  const en = JSON.parse(readFileSync(path.join(dir, "en/groups.json"), "utf8")) as Record<string, string>;
  const es = JSON.parse(readFileSync(path.join(dir, "es/groups.json"), "utf8")) as Record<string, string>;
  assert.deepEqual(Object.keys(en).sort(), Object.keys(es).sort());
  for (const key of ["createPrivacyInvite", "joinCta", "joinOpen", "joinInvalid", "joinPending"] as const) {
    assert.notEqual(en[key], es[key]);
  }
});

test("join preview migration does not demote members or expose the share code", () => {
  const sql = readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../supabase/migrations/20260923210000_group_join_preview.sql",
    ),
    "utf8",
  );
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.join_group_by_code\(p_code text\)/);
  assert.match(sql, /RETURNS group_members/);
  assert.match(sql, /ON CONFLICT \(group_id, user_id\) DO NOTHING/);
  assert.match(sql, /VALUES \(v_user_id, 0\)/);
  assert.match(sql, /RAISE EXCEPTION 'Group not found'/);
  assert.doesNotMatch(sql, /DO UPDATE SET role/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.preview_group_by_code\(p_code text\)/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.preview_group_by_code\(text\) TO authenticated/);
  assert.doesNotMatch(sql, /CREATE POLICY/i);
  assert.doesNotMatch(sql, /ADD COLUMN/i);

  const signatureStart = sql.indexOf("RETURNS TABLE (");
  const signatureEnd = sql.indexOf(")", signatureStart);
  assert.ok(signatureStart > 0 && signatureEnd > signatureStart);
  assert.equal(sql.slice(signatureStart, signatureEnd).includes("share_code"), false);
  assert.match(sql, /is_member boolean/);
  assert.match(sql, /member_count bigint/);
});
