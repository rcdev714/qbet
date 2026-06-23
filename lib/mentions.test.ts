import assert from "node:assert/strict";
import test from "node:test";

import { detectMentionQuery, stripMentionTrigger } from "./mentions";

test("detectMentionQuery returns null when no @ present", () => {
  assert.equal(detectMentionQuery("hello world"), null);
});

test("detectMentionQuery detects active mention at end", () => {
  assert.deepEqual(detectMentionQuery("hey @ali"), {
    active: true,
    query: "ali",
    triggerStart: 4,
  });
});

test("detectMentionQuery ignores @ in the middle of a word", () => {
  assert.equal(detectMentionQuery("email@test.com"), null);
});

test("detectMentionQuery stops at whitespace", () => {
  assert.equal(detectMentionQuery("hey @ali there"), null);
});

test("stripMentionTrigger removes @query fragment", () => {
  assert.equal(stripMentionTrigger("hey @ali", 4), "hey ");
});
