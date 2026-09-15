import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeNMin,
  computeReopenThreshold,
  evaluateReopen,
  wilsonLowerBound,
} from "./reopen-evaluator";

describe("reopen-evaluator", () => {
  it("computeNMin scales with eligible bettors", () => {
    assert.equal(computeNMin(3), 3);
    assert.equal(computeNMin(25), 5);
    assert.equal(computeNMin(100), 10);
  });

  it("threshold approaches 0.70 for large n", () => {
    const t = computeReopenThreshold(30);
    assert.ok(t > 0.68 && t < 0.71);
  });

  it("wilson lower bound is conservative for small n", () => {
    assert.ok(wilsonLowerBound(1, 3) < 1);
    assert.ok(wilsonLowerBound(0.7, 30) < 0.7);
  });

  it("does not reopen with 2 unfair votes", () => {
    const r = evaluateReopen({
      eligibleBettors: 10,
      downvotes: 2,
      upvotes: 0,
      collusionExcluded: 0,
    });
    assert.equal(r.decision, "none");
  });

  it("reopen candidate when 3/3 unfair in small group", () => {
    const r = evaluateReopen({
      eligibleBettors: 3,
      downvotes: 3,
      upvotes: 0,
      collusionExcluded: 0,
    });
    assert.equal(r.decision, "reopen_candidate");
  });

  it("no auto reopen at 6/10 unfair (~60%)", () => {
    const r = evaluateReopen({
      eligibleBettors: 10,
      downvotes: 6,
      upvotes: 4,
      collusionExcluded: 0,
    });
    assert.notEqual(r.decision, "reopen_candidate");
  });

  it("reopen at 27/30 unfair (~90%)", () => {
    const r = evaluateReopen({
      eligibleBettors: 30,
      downvotes: 27,
      upvotes: 3,
      collusionExcluded: 0,
    });
    assert.equal(r.decision, "reopen_candidate");
  });

  it("blocks when majority collusion excluded", () => {
    const r = evaluateReopen({
      eligibleBettors: 10,
      downvotes: 7,
      upvotes: 3,
      collusionExcluded: 6,
    });
    assert.equal(r.decision, "collusion_blocked");
  });
});
