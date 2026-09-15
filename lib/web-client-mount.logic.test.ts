import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  getInitialClientMountState,
  shouldRenderClientOnlyChildren,
  shouldShowBootstrapLoader,
  simulateWebBootstrapMountSequence,
} from "./web-client-mount.logic";

const layoutSource = readFileSync(
  join(import.meta.dirname, "../app/_layout.tsx"),
  "utf8",
);
const clientOnlySource = readFileSync(
  join(import.meta.dirname, "../components/ClientOnlyWebApp.tsx"),
  "utf8",
);

describe("web client mount gate", () => {
  it("starts unmounted on web so SSR/hydration shell is blank", () => {
    assert.equal(getInitialClientMountState(true), false);
    assert.equal(shouldRenderClientOnlyChildren(false), false);
  });

  it("starts mounted on native without waiting for an effect", () => {
    assert.equal(getInitialClientMountState(false), true);
    assert.equal(shouldRenderClientOnlyChildren(true), true);
  });

  it("shows bootstrap loader on first RootLayoutNav paint while auth is loading", () => {
    const frames = simulateWebBootstrapMountSequence(true);
    const rootNavFirstPaint = frames.find((frame) => frame.phase === "rootNavFirstPaint");

    assert.ok(rootNavFirstPaint);
    assert.equal(rootNavFirstPaint.rendersAppShell, true);
    assert.equal(rootNavFirstPaint.showBootstrapLoader, true);
    assert.equal(rootNavFirstPaint.routeGuardActive, false);
  });

  it("keeps loader visible for signed-in users until onboarding state is ready", () => {
    assert.equal(
      shouldShowBootstrapLoader({
        loading: false,
        hasSession: true,
        policyCheckDone: false,
        userId: "user-1",
      }),
      true,
    );

    assert.equal(
      shouldShowBootstrapLoader({
        loading: false,
        hasSession: true,
        policyCheckDone: true,
        userId: null,
      }),
      true,
    );
  });

  it("hides loader once auth and onboarding checks are complete", () => {
    const frames = simulateWebBootstrapMountSequence(false, true, true, "user-1");
    const settled = frames.find((frame) => frame.phase === "rootNavAfterAuthReady");

    assert.ok(settled);
    assert.equal(settled.showBootstrapLoader, false);
    assert.equal(settled.routeGuardActive, true);
  });
});

describe("_layout web bootstrap regression", () => {
  it("does not reintroduce a clientMounted gate on the bootstrap loader", () => {
    assert.doesNotMatch(layoutSource, /\bclientMounted\b/);
    assert.match(layoutSource, /shouldShowBootstrapLoader\(\{/);
    assert.doesNotMatch(layoutSource, /showBootstrapLoader[\s\S]*clientMounted/);
  });

  it("wraps the app in ClientOnlyWebApp on web", () => {
    assert.match(layoutSource, /from '@\/components\/ClientOnlyWebApp'/);
    assert.match(layoutSource, /<ClientOnlyWebApp>/);
    assert.match(clientOnlySource, /if \(!mounted\) return null;/);
    assert.match(clientOnlySource, /getInitialClientMountState\(Platform\.OS === "web"\)/);
  });
});
