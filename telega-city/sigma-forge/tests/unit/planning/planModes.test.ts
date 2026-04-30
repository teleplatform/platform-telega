import assert from "node:assert/strict";
import { resolvePlanMode } from "../../../packages/fsgr-runtime/src/planning/planModes.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nPlan Modes:");

test("execution_mode overrides default", () => {
  const task = { task_id: "t1", actor_id: "a1", actor_mode: "public", intent_key: "k1", task_kind: "ui_fix", goal: "Fix", constraints: [], execution_mode: "fast" };
  assert.equal(resolvePlanMode(task), "fast");
});

test("execution_mode overrides default (quality)", () => {
  const task = { task_id: "t2", actor_id: "a2", actor_mode: "public", intent_key: "k2", task_kind: "ui_fix", goal: "Fix", constraints: [], execution_mode: "quality" };
  assert.equal(resolvePlanMode(task), "quality");
});

test("creator mode gets safe by default", () => {
  const task = { task_id: "t3", actor_id: "a3", actor_mode: "creator", intent_key: "k3", task_kind: "landing_build", goal: "Build landing", constraints: [], execution_mode: "safe" };
  assert.equal(resolvePlanMode(task), "safe");
});

test("multi-family classified task gets quality", () => {
  const classified = { task_kind: "landing_build", primary_family_candidates: ["frontend", "content"], inferred_tags: ["build"], execution_hints: { multi_family: true } };
  const task = { task_id: "t4", actor_id: "a4", actor_mode: "public", intent_key: "k4", task_kind: "landing_build", goal: "Build landing", constraints: [] };
  assert.equal(resolvePlanMode(task as any, classified as any), "quality");
});

test("internal mode gets safe", () => {
  const task = { task_id: "t5", actor_id: "a5", actor_mode: "internal", intent_key: "k5", task_kind: "api_build", goal: "Build API", constraints: [], execution_mode: "safe" };
  assert.equal(resolvePlanMode(task), "safe");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
