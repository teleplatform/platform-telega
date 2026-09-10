/**
 * Phase 6C.3A — pure soft-policy hint helper unit tests.
 *
 * Proves the frozen contract of `applyPolicyHintToRanking`:
 *  - base ranking is treated as immutable;
 *  - bonus is bounded (+0.03 SHADOW candidate, hard ceiling 0.10);
 *  - adjusted scores clamp to 1.0;
 *  - clamped equality preserves base rank;
 *  - ineligible / not-present target → no-op;
 *  - single candidate behavior;
 *  - deterministic output.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyPolicyHintToRanking,
  POLICY_HINT_BONUS,
  POLICY_HINT_HARD_CEILING,
} from "../../../src/core/policy-hint.js";

const BASE = [
  { providerId: "openai_api", score: 0.955 },
  { providerId: "kimi_api", score: 0.91 },
  { providerId: "local", score: 0.87 },
] as { providerId: string; score: number }[];

const approx = (actual: number, expected: number, eps = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < eps, `expected ~${expected}, got ${actual}`);

describe("Phase 6C.3A — applyPolicyHintToRanking", () => {
  it("constants: low = +0.03 SHADOW candidate, ceiling = 0.10", () => {
    assert.equal(POLICY_HINT_BONUS.low, 0.03);
    assert.equal(POLICY_HINT_BONUS.tie_break, 0);
    assert.equal(POLICY_HINT_HARD_CEILING, 0.10);
  });

  it("applies +0.03 to the preferred provider and re-sorts", () => {
    const nearTie = [
      { providerId: "openai_api", score: 0.955 },
      { providerId: "kimi_api", score: 0.93 },
      { providerId: "local", score: 0.87 },
    ];
    const adjusted = applyPolicyHintToRanking(nearTie, {
      preferredProviderId: "kimi_api",
      strength: "low",
      ruleId: "r1",
      ruleName: "R1",
    });
    assert.equal(adjusted.hintApplied, true);
    assert.equal(adjusted.ranked[0].providerId, "kimi_api");
    assert.equal(adjusted.ranked[0].baseScore, 0.93);
    approx(adjusted.ranked[0].adjustedScore, 0.96);
    assert.equal(adjusted.ranked[0].baseRank, 1);
    assert.equal(adjusted.ranked[0].adjustedRank, 0);
  });

  it("is deterministic: identical input → identical output", () => {
    const a = applyPolicyHintToRanking(BASE, {
      preferredProviderId: "kimi_api",
      strength: "low",
      ruleId: "r1",
    });
    const b = applyPolicyHintToRanking(BASE, {
      preferredProviderId: "kimi_api",
      strength: "low",
      ruleId: "r1",
    });
    assert.deepEqual(a, b);
  });

  it("never mutates the base ranking input", () => {
    const input = BASE.map((p) => ({ ...p }));
    const snapshot = JSON.parse(JSON.stringify(input));
    applyPolicyHintToRanking(input, {
      preferredProviderId: "kimi_api",
      strength: "low",
      ruleId: "r1",
    });
    assert.deepEqual(input, snapshot);
  });

  it("clamps adjusted score to 1.0", () => {
    const nearTop = [
      { providerId: "openai_api", score: 0.98 },
      { providerId: "kimi_api", score: 0.95 },
    ];
    const adjusted = applyPolicyHintToRanking(nearTop, {
      preferredProviderId: "kimi_api",
      strength: "low",
      ruleId: "r1",
    });
    assert.equal(adjusted.ranked.find((e) => e.providerId === "kimi_api")?.adjustedScore, 0.98);
    assert.ok(adjusted.ranked.every((e) => e.adjustedScore <= 1.0));
  });

  it("clamped equality preserves base rank order", () => {
    const input = [
      { providerId: "openai_api", score: 1.0 },
      { providerId: "kimi_api", score: 0.98 },
    ];
    const adjusted = applyPolicyHintToRanking(input, {
      preferredProviderId: "kimi_api",
      strength: "low",
      ruleId: "r1",
    });
    // kimi 0.98 + 0.03 → 1.00 == openai 1.00 → base rank preserved: openai wins.
    assert.equal(adjusted.ranked[0].providerId, "openai_api");
    assert.equal(adjusted.ranked[1].providerId, "kimi_api");
    assert.equal(adjusted.ranked[0].adjustedScore, 1.0);
    assert.equal(adjusted.ranked[1].adjustedScore, 1.0);
  });

  it("not-present (ineligible) target → no-op with hintApplied=false", () => {
    const adjusted = applyPolicyHintToRanking(BASE, {
      preferredProviderId: "zyloo_api",
      strength: "low",
      ruleId: "r1",
    });
    assert.equal(adjusted.hintApplied, false);
    assert.deepEqual(
      adjusted.ranked.map((e) => e.providerId),
      ["openai_api", "kimi_api", "local"],
    );
    assert.ok(
      adjusted.ranked.every((e) => e.adjustedScore === e.baseScore),
    );
  });

  it("single candidate: bonus applied, no decision change signal", () => {
    const single = [{ providerId: "openai_api", score: 0.9 }];
    const adjusted = applyPolicyHintToRanking(single, {
      preferredProviderId: "openai_api",
      strength: "low",
      ruleId: "r1",
    });
    assert.equal(adjusted.hintApplied, true);
    assert.equal(adjusted.ranked.length, 1);
    assert.equal(adjusted.ranked[0].providerId, "openai_api");
    assert.equal(adjusted.ranked[0].baseRank, 0);
    assert.equal(adjusted.ranked[0].adjustedRank, 0);
  });

  it("tie_break is reserved/inactive → zero bonus, no-op ranking change", () => {
    const adjusted = applyPolicyHintToRanking(BASE, {
      preferredProviderId: "kimi_api",
      strength: "tie_break",
      ruleId: "r1",
    });
    assert.equal(adjusted.hintApplied, false);
    assert.ok(adjusted.ranked.every((e) => e.adjustedScore === e.baseScore));
    assert.deepEqual(
      adjusted.ranked.map((e) => e.providerId),
      ["openai_api", "kimi_api", "local"],
    );
  });

  it("equal base scores: bonus breaks the tie for the preferred provider", () => {
    const tied = [
      { providerId: "kimi_api", score: 0.5 },
      { providerId: "openai_api", score: 0.5 },
    ];
    const adjusted = applyPolicyHintToRanking(tied, {
      preferredProviderId: "kimi_api",
      strength: "low",
      ruleId: "r1",
    });
    assert.equal(adjusted.ranked[0].providerId, "kimi_api");
    approx(adjusted.ranked[0].adjustedScore, 0.53);
  });
});