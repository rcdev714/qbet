import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  includeActorInFeed,
  isMissingRpcError,
  profileActivityVisibleToViewer,
  resolveSocialFeedMode,
  socialFeedActionRowFits,
} from "./feed-visibility";

const viewer = "viewer";
const alice = "alice";
const bob = "bob";

test("no follows resolves to Discover, including an explicit Following tap", () => {
  assert.deepEqual(resolveSocialFeedMode({ requested: "auto", followingCount: 0 }), {
    mode: "discover",
    coercedFromFollowing: false,
  });
  assert.deepEqual(resolveSocialFeedMode({ requested: "following", followingCount: 0 }), {
    mode: "discover",
    coercedFromFollowing: true,
  });
});

test("follows keep Following scoped and still allow an explicit Discover tab", () => {
  assert.deepEqual(resolveSocialFeedMode({ requested: "auto", followingCount: 2 }), {
    mode: "following",
    coercedFromFollowing: false,
  });
  assert.deepEqual(resolveSocialFeedMode({ requested: "discover", followingCount: 4 }), {
    mode: "discover",
    coercedFromFollowing: false,
  });
});

test("activity sharing hides actors from both modes and hides self", () => {
  assert.equal(
    includeActorInFeed({
      mode: "following",
      viewerId: viewer,
      actorId: alice,
      showActivityOnFeed: true,
      viewerFollowsActor: true,
    }),
    true,
  );
  assert.equal(
    includeActorInFeed({
      mode: "following",
      viewerId: viewer,
      actorId: bob,
      showActivityOnFeed: true,
      viewerFollowsActor: false,
    }),
    false,
  );
  assert.equal(
    includeActorInFeed({
      mode: "discover",
      viewerId: viewer,
      actorId: alice,
      showActivityOnFeed: false,
      viewerFollowsActor: true,
    }),
    false,
  );
  assert.equal(
    includeActorInFeed({
      mode: "discover",
      viewerId: viewer,
      actorId: viewer,
      showActivityOnFeed: true,
      viewerFollowsActor: false,
    }),
    false,
  );
});

test("profile activity stays visible to the owner when sharing is off", () => {
  assert.equal(profileActivityVisibleToViewer({ isOwner: true, showActivityOnFeed: false }), true);
  assert.equal(profileActivityVisibleToViewer({ isOwner: false, showActivityOnFeed: false }), false);
  assert.equal(profileActivityVisibleToViewer({ isOwner: false, showActivityOnFeed: true }), true);
});

test("action row fits common iOS and Android phone widths", () => {
  for (const width of [320, 360, 390, 393, 412, 430]) {
    assert.equal(socialFeedActionRowFits(width), true, `expected fit at ${width}`);
  }
  assert.equal(socialFeedActionRowFits(250), false);
});

test("missing RPC errors are recognizable for pre-migration fallbacks", () => {
  assert.equal(isMissingRpcError({ code: "PGRST202", message: "not in schema cache" }), true);
  assert.equal(isMissingRpcError({ message: "function get_social_feed does not exist" }), true);
  assert.equal(isMissingRpcError({ code: "42501", message: "permission denied" }), false);
});

test("migration publishes the shared Discover / Following contract", () => {
  const sql = readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../supabase/migrations/20260923190000_social_activity_sharing.sql",
    ),
    "utf8",
  );
  assert.match(sql, /show_activity_on_feed boolean not null default true/);
  assert.match(sql, /get_social_feed/);
  assert.match(sql, /set_show_activity_on_feed/);
  assert.match(sql, /get_profile_activity/);
  assert.match(sql, /'discover'/);
  assert.match(sql, /'following'/);
  assert.match(sql, /social_feed_group_visible/);
  assert.match(sql, /md5\(gm\.user_id::text \|\| ':' \|\| gm\.group_id::text \|\| ':joined'\)::uuid/);
  assert.doesNotMatch(sql, /create or replace function public\.update_own_privacy/i);
});
