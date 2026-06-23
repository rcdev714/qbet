import assert from "node:assert/strict";
import test from "node:test";
import {
    mapDiscoverableUser,
    mapDiscoverableUsers,
    parseToggleFollowResponse,
} from "./social.parsers";

test("parseToggleFollowResponse returns true when following", () => {
    assert.equal(parseToggleFollowResponse({ following: true }), true);
});

test("parseToggleFollowResponse returns false when unfollowing", () => {
    assert.equal(parseToggleFollowResponse({ following: false }), false);
});

test("parseToggleFollowResponse ignores legacy action field", () => {
    assert.equal(parseToggleFollowResponse({ action: "followed" }), false);
});

test("mapDiscoverableUser normalizes RPC row", () => {
    assert.deepEqual(
        mapDiscoverableUser({
            user_id: "11111111-1111-1111-1111-111111111111",
            username: "alice",
            avatar_url: "https://example.com/a.png",
            created_at: "2026-01-01T00:00:00.000Z",
            total_bets: 3,
            is_following: true,
        }),
        {
            user_id: "11111111-1111-1111-1111-111111111111",
            username: "alice",
            avatar_url: "https://example.com/a.png",
            created_at: "2026-01-01T00:00:00.000Z",
            total_bets: 3,
            is_following: true,
        },
    );
});

test("mapDiscoverableUser coerces null avatar and missing stats", () => {
    assert.deepEqual(
        mapDiscoverableUser({
            user_id: "22222222-2222-2222-2222-222222222222",
            username: "bob",
            avatar_url: null,
            created_at: "2026-02-01T00:00:00.000Z",
            is_following: false,
        }),
        {
            user_id: "22222222-2222-2222-2222-222222222222",
            username: "bob",
            avatar_url: null,
            created_at: "2026-02-01T00:00:00.000Z",
            total_bets: 0,
            is_following: false,
        },
    );
});

test("mapDiscoverableUsers maps arrays", () => {
    assert.equal(
        mapDiscoverableUsers([
            { user_id: "a", username: "a", created_at: "2026-01-01", is_following: false },
        ]).length,
        1,
    );
});
