// AuthZ Modes Tests — Pack 2 — run with: npx tsx tests/unit/authz/modes.test.ts

import assert from "node:assert/strict";
import {
  parseMode,
  inferModeFromRole,
  resolveActorMode,
  clampModeToRole,
  isCreatorMode,
  isSystemMode,
  isInternalMode,
  isPublicMode,
} from "../../../src/core/authz/modes.js";
import { modeGte } from "../../../src/types/authz.js";

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

console.log("\nparseMode:");

test("parses 'creator'", () => {
  assert.equal(parseMode("creator"), "creator");
});

test("parses 'CREATOR' (case insensitive)", () => {
  assert.equal(parseMode("CREATOR"), "creator");
});

test("defaults to 'public' for unknown mode", () => {
  assert.equal(parseMode("unknown"), "public");
});

test("parses 'system'", () => {
  assert.equal(parseMode("system"), "system");
});

test("parses 'internal'", () => {
  assert.equal(parseMode("internal"), "internal");
});

console.log("\ninferModeFromRole:");

test("system role → system mode", () => {
  assert.equal(inferModeFromRole("system"), "system");
});

test("internal role → internal mode", () => {
  assert.equal(inferModeFromRole("internal"), "internal");
});

test("creator role → creator mode", () => {
  assert.equal(inferModeFromRole("creator"), "creator");
});

test("public role → public mode", () => {
  assert.equal(inferModeFromRole("public"), "public");
});

console.log("\nclampModeToRole:");

test("public cannot escalate to creator", () => {
  assert.equal(clampModeToRole("creator", "public"), "public");
});

test("creator cannot escalate to system", () => {
  assert.equal(clampModeToRole("system", "creator"), "creator");
});

test("creator can stay at creator", () => {
  assert.equal(clampModeToRole("creator", "creator"), "creator");
});

test("internal can be creator (de-escalate)", () => {
  assert.equal(clampModeToRole("creator", "internal"), "creator");
});

console.log("\nmodeGte:");

test("system >= creator", () => {
  assert.equal(modeGte("system", "creator"), true);
});

test("public >= creator is false", () => {
  assert.equal(modeGte("public", "creator"), false);
});

test("creator >= creator", () => {
  assert.equal(modeGte("creator", "creator"), true);
});

console.log("\nmode type guards:");

test("isCreatorMode for creator", () => {
  assert.equal(isCreatorMode("creator"), true);
});

test("isSystemMode for system", () => {
  assert.equal(isSystemMode("system"), true);
});

test("isInternalMode for internal", () => {
  assert.equal(isInternalMode("internal"), true);
});

test("isPublicMode for public", () => {
  assert.equal(isPublicMode("public"), true);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
