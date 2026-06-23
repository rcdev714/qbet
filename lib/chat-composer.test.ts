import assert from "node:assert/strict";
import test from "node:test";

import {
    CHAT_MESSAGE_MAX_LENGTH,
    isEnterWithModifier,
    resolveSendShortcutLabel,
} from "./chat-composer.logic";

test("CHAT_MESSAGE_MAX_LENGTH is 2000", () => {
  assert.equal(CHAT_MESSAGE_MAX_LENGTH, 2000);
});

test("isEnterWithModifier returns false for plain Enter", () => {
  assert.equal(isEnterWithModifier({ key: "Enter" }), false);
});

test("isEnterWithModifier returns true for Enter with metaKey", () => {
  assert.equal(isEnterWithModifier({ key: "Enter", metaKey: true }), true);
});

test("isEnterWithModifier returns true for Enter with ctrlKey", () => {
  assert.equal(isEnterWithModifier({ key: "Enter", ctrlKey: true }), true);
});

test("isEnterWithModifier returns false for non-Enter keys", () => {
  assert.equal(isEnterWithModifier({ key: "a", metaKey: true }), false);
});

test("resolveSendShortcutLabel returns Mac shortcut on Apple platforms", () => {
  assert.equal(resolveSendShortcutLabel(true), "⌘↵");
});

test("resolveSendShortcutLabel returns Ctrl shortcut elsewhere", () => {
  assert.equal(resolveSendShortcutLabel(false), "Ctrl↵");
});
