// Router Lanes Tests — Pack 3 — run with: npx tsx tests/unit/router/lanes.test.ts

import assert from "node:assert/strict";
import {
  LANES,
  isLaneAllowedForMode,
  getDefaultLaneForMode,
  getCandidateLanesForMode,
  laneMatchesPrivacy,
  laneMatchesBudget,
} from "../../../src/core/router/lanes.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
  }
}

console.log("\nLane definitions:");

test("cheap lane exists", () => {
  assert.ok(LANES.cheap);
  assert.equal(LANES.cheap.cost_class, "low");
});

test("smart lane has high reasoning", () => {
  assert.equal(LANES.smart.reasoning_depth, "high");
  assert.equal(LANES.smart.cost_class, "high");
});

test("private lane is local_only", () => {
  assert.equal(LANES.private.privacy_class, "local_only");
});

test("creator lane is restricted", () => {
  assert.ok(!LANES.creator.allowed_for.includes("public"));
  assert.ok(LANES.creator.allowed_for.includes("creator"));
});

console.log("\nLane eligibility by mode:");

test("public can use cheap lane", () => {
  assert.equal(isLaneAllowedForMode("cheap", "public"), true);
});

test("public CANNOT use creator lane", () => {
  assert.equal(isLaneAllowedForMode("creator", "public"), false);
});

test("creator can use smart lane", () => {
  assert.equal(isLaneAllowedForMode("smart", "creator"), true);
});

test("system can use all lanes", () => {
  assert.equal(isLaneAllowedForMode("cheap", "system"), true);
  assert.equal(isLaneAllowedForMode("smart", "system"), true);
  assert.equal(isLaneAllowedForMode("private", "system"), true);
  assert.equal(isLaneAllowedForMode("creator", "system"), true);
});

console.log("\nDefault lanes:");

test("public default lane is cheap", () => {
  assert.equal(getDefaultLaneForMode("public"), "cheap");
});

test("creator default lane is smart", () => {
  assert.equal(getDefaultLaneForMode("creator"), "smart");
});

console.log("\nCandidate lanes:");

test("public gets 3 candidate lanes (cheap, private, smart)", () => {
  const lanes = getCandidateLanesForMode("public");
  assert.ok(lanes.includes("cheap"));
  assert.ok(lanes.includes("private"));
  assert.equal(lanes.includes("creator"), false);
});

test("creator gets all 4 lanes", () => {
  const lanes = getCandidateLanesForMode("creator");
  assert.equal(lanes.length, 4);
});

console.log("\nPrivacy matching:");

test("require_local matches only private lane", () => {
  assert.equal(laneMatchesPrivacy("private", "require_local"), true);
  assert.equal(laneMatchesPrivacy("cheap", "require_local"), false);
  assert.equal(laneMatchesPrivacy("smart", "require_local"), false);
});

test("prefer_local matches local and cheap", () => {
  assert.equal(laneMatchesPrivacy("private", "prefer_local"), true);
  assert.equal(laneMatchesPrivacy("cheap", "prefer_local"), true);
});

console.log("\nBudget matching:");

test("low budget matches only cheap lane", () => {
  assert.equal(laneMatchesBudget("cheap", "low"), true);
  assert.equal(laneMatchesBudget("smart", "low"), false);
});

test("high budget matches all lanes", () => {
  assert.equal(laneMatchesBudget("cheap", "high"), true);
  assert.equal(laneMatchesBudget("smart", "high"), true);
  assert.equal(laneMatchesBudget("creator", "high"), true);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
