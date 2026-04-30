import assert from "node:assert/strict";
import { getFamiliesForTaskKind, isFamilyAllowedForTaskKind, ALL_SKILL_FAMILIES } from "../../../packages/fsgr-runtime/src/skills/families.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nSkill Families:");

test("ALL_SKILL_FAMILIES has 5 families", () => {
  assert.equal(ALL_SKILL_FAMILIES.length, 5);
});

test("ui_fix maps to frontend + ops", () => {
  const families = getFamiliesForTaskKind("ui_fix");
  assert.ok(families.includes("frontend"));
  assert.ok(families.includes("ops"));
});

test("landing_build maps to frontend + content", () => {
  const families = getFamiliesForTaskKind("landing_build");
  assert.ok(families.includes("frontend"));
  assert.ok(families.includes("content"));
});

test("api_build maps to backend + ops", () => {
  const families = getFamiliesForTaskKind("api_build");
  assert.ok(families.includes("backend"));
  assert.ok(families.includes("ops"));
});

test("research_compare maps to research + content", () => {
  const families = getFamiliesForTaskKind("research_compare");
  assert.ok(families.includes("research"));
  assert.ok(families.includes("content"));
});

test("unknown task_kind returns fallback families", () => {
  const families = getFamiliesForTaskKind("unknown_xyz");
  assert.ok(families.includes("content"));
  assert.ok(families.includes("ops"));
});

test("isFamilyAllowedForTaskKind works", () => {
  assert.equal(isFamilyAllowedForTaskKind("ui_fix", "frontend"), true);
  assert.equal(isFamilyAllowedForTaskKind("ui_fix", "backend"), false);
  assert.equal(isFamilyAllowedForTaskKind("api_build", "backend"), true);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
