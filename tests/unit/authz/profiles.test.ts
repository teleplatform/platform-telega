// AuthZ Profiles Tests — Pack 2 — run with: npx tsx tests/unit/authz/profiles.test.ts

import assert from "node:assert/strict";
import {
  buildCapabilityProfile,
  hasCapability,
  canAccessProvider,
  canInvokeTool,
} from "../../../src/core/authz/profiles.js";

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

console.log("\nPublic profile:");

const publicProfile = buildCapabilityProfile("tg:123", "public", "public");

test("public has run_agent", () => {
  assert.ok(hasCapability(publicProfile, "run_agent"));
});

test("public does NOT have read_stream", () => {
  assert.equal(hasCapability(publicProfile, "read_stream"), false);
});

test("public does NOT have provider.creator.use", () => {
  assert.equal(hasCapability(publicProfile, "provider.creator.use"), false);
});

test("public can only use local provider", () => {
  assert.ok(canAccessProvider(publicProfile, "local"));
  assert.equal(canAccessProvider(publicProfile, "openai"), false);
});

test("public has no tool access", () => {
  assert.equal(canInvokeTool(publicProfile, "fs.read"), false);
});

test("public budget is limited", () => {
  assert.equal(publicProfile.budget.limit_usd, 1.0);
  assert.equal(publicProfile.budget.max_sessions_per_day, 50);
});

test("public rate is limited", () => {
  assert.equal(publicProfile.rate.max_requests_per_minute, 10);
  assert.equal(publicProfile.rate.max_concurrent_sessions, 3);
});

console.log("\nCreator profile:");

const creatorProfile = buildCapabilityProfile("maker:123", "creator", "creator");

test("creator has read_stream", () => {
  assert.ok(hasCapability(creatorProfile, "read_stream"));
});

test("creator has provider.creator.use", () => {
  assert.ok(hasCapability(creatorProfile, "provider.creator.use"));
});

test("creator can use openai provider", () => {
  assert.ok(canAccessProvider(creatorProfile, "openai"));
});

test("creator can use fs.read tool", () => {
  assert.ok(canInvokeTool(creatorProfile, "fs.read"));
});

test("creator can use forge tool", () => {
  assert.ok(canInvokeTool(creatorProfile, "forge.run"));
});

test("creator has higher budget", () => {
  assert.equal(creatorProfile.budget.limit_usd, 10.0);
  assert.equal(creatorProfile.budget.max_sessions_per_day, 500);
});

test("creator has streaming enabled", () => {
  assert.equal(creatorProfile.feature_flags.streaming, true);
});

test("creator has evidence_verify enabled", () => {
  assert.equal(creatorProfile.feature_flags.evidence_verify, true);
});

test("creator has creator_lanes enabled", () => {
  assert.equal(creatorProfile.feature_flags.creator_lanes, true);
});

console.log("\nSystem profile:");

const systemProfile = buildCapabilityProfile("actor:system", "system", "system");

test("system has policy.override.system", () => {
  assert.ok(hasCapability(systemProfile, "policy.override.system"));
});

test("system can use any provider", () => {
  assert.ok(canAccessProvider(systemProfile, "any_provider"));
});

test("system can use any tool", () => {
  assert.ok(canInvokeTool(systemProfile, "any_tool"));
});

test("system has unlimited budget", () => {
  assert.equal(systemProfile.budget.limit_usd, Infinity);
});

test("system has unlimited rate", () => {
  assert.equal(systemProfile.rate.max_requests_per_minute, Infinity);
});

console.log("\nCreator ≠ System:");

test("creator does NOT have policy.override.system", () => {
  assert.equal(hasCapability(creatorProfile, "policy.override.system"), false);
});

test("creator does NOT have policy.override.internal", () => {
  assert.equal(hasCapability(creatorProfile, "policy.override.internal"), false);
});

test("creator does NOT have execute_workspace", () => {
  assert.equal(hasCapability(creatorProfile, "execute_workspace"), false);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
