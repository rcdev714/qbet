import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  DISPLAY_NAME_MAX,
  randomSocialName,
  socialHandle,
  socialLabel,
  USERNAME_MAX,
} from "./display-name";
import { parseStickerContent, pushRecentSticker, stickerContent, STICKERS } from "./stickers";

test("social label prefers display name and never invents an email", () => {
  assert.equal(socialLabel({ displayName: "SwiftOtter42", username: "swiftotter42" }), "SwiftOtter42");
  assert.equal(socialLabel({ displayName: "  ", username: "swiftotter42" }), "swiftotter42");
  assert.equal(socialLabel({ displayName: null, username: null, fallback: "Someone" }), "Someone");
  assert.equal(socialHandle("swiftotter42"), "@swiftotter42");
  assert.equal(socialHandle("  "), null);
});

test("random social names are AdjectiveNoun## and fit the profile limits", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 40; i += 1) {
    const name = randomSocialName(() => (i * 17 + 3) % 100 / 100);
    assert.match(name.username, /^[a-z]+[0-9]{2}$/);
    assert.match(name.displayName, /^[A-Z][a-z]+[A-Z][a-z]+[0-9]{2}$/);
    assert.equal(name.displayName.toLowerCase(), name.username);
    assert.ok(name.username.length <= USERNAME_MAX);
    assert.ok(name.displayName.length <= DISPLAY_NAME_MAX);
    seen.add(name.username);
  }
  assert.ok(seen.size > 1);
});

test("sticker messages use sticker:pack:slug and unknown packs still parse", () => {
  const sticker = STICKERS[0];
  assert.ok(sticker);
  const content = stickerContent(sticker);
  const parsed = parseStickerContent(content);
  assert.equal(parsed?.sticker?.emoji, sticker.emoji);
  assert.equal(parseStickerContent("hello"), null);
  const foreign = parseStickerContent("sticker:odds:future");
  assert.equal(foreign?.pack, "odds");
  assert.equal(foreign?.slug, "future");
  assert.equal(foreign?.sticker, null);
  assert.deepEqual(pushRecentSticker(["sticker:odds:chart", content], content), [
    content,
    "sticker:odds:chart",
  ]);
});

test("migration assigns social names and documents the sticker message shape", () => {
  const sql = readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../supabase/migrations/20260923201000_social_display_names.sql",
    ),
    "utf8",
  );
  assert.match(sql, /display_name text/);
  assert.match(sql, /generate_social_name/);
  assert.match(sql, /ensure_social_display_name/);
  assert.match(sql, /update_own_profile\(text, text, text, text\)/);
  assert.match(sql, /message_type = 'sticker'/);
  assert.match(sql, /sticker:<pack>:<slug>/);
  assert.match(sql, /'swift'/);
  assert.match(sql, /'otter'/);
  assert.doesNotMatch(sql, /unique index.*display_name/i);
});

test("feed rows include display_name and the legacy activity RPC does not", () => {
  const sql = readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../supabase/migrations/20260923190000_social_activity_sharing.sql",
    ),
    "utf8",
  );
  assert.match(sql, /username text,\n  display_name text,\n  avatar_url text/);
  assert.ok((sql.match(/u\.display_name/g) ?? []).length >= 6);
  const start = sql.indexOf("create or replace function public.get_following_activity(p_limit int default 30)");
  const end = sql.indexOf("create or replace function public.profile_activity_is_visible");
  assert.ok(start > 0 && end > start);
  assert.equal(sql.slice(start, end).includes("display_name"), false);
});
