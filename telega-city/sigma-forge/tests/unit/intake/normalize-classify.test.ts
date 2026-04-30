import assert from "node:assert/strict";
import { normalizeTaskIntent } from "../../../packages/fsgr-runtime/src/intake/normalizeTask.js";
import { classifyTaskIntent } from "../../../packages/fsgr-runtime/src/intake/classifyTask.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nNormalize + Classify:");

test("normalize trims strings", () => {
  const result = normalizeTaskIntent({
    task_id: "  t1  ", actor_id: "  a1  ", actor_mode: "public",
    intent_key: "  k1  ", task_kind: "  UI_Fix  ", goal: "  Fix UI  ",
    constraints: ["  c1  ", "  "], execution_mode: "fast",
  });
  assert.equal(result.task_id, "t1");
  assert.equal(result.actor_id, "a1");
  assert.equal(result.intent_key, "k1");
  assert.equal(result.task_kind, "ui_fix");
  assert.equal(result.goal, "Fix UI");
  assert.deepEqual(result.constraints, ["c1"]);
});

test("normalize defaults missing fields", () => {
  const result = normalizeTaskIntent({
    task_id: "", actor_id: "a1", actor_mode: "public",
    intent_key: "", task_kind: "", goal: "",
    constraints: [], execution_mode: "fast",
  });
  assert.ok(result.task_id.startsWith("task_"));
  assert.equal(result.intent_key, "default");
  assert.equal(result.task_kind, "general");
  assert.equal(result.goal, "Process task");
  assert.equal(result.execution_mode, "fast");
});

test("classify after normalize", () => {
  const normalized = normalizeTaskIntent({
    task_id: "", actor_id: "a1", actor_mode: "public",
    intent_key: "", task_kind: "", goal: "",
    constraints: [], execution_mode: "fast",
  });
  const result = classifyTaskIntent(normalized);
  assert.equal(result.task_kind, "general");
  assert.ok(result.primary_family_candidates.includes("content"));
  assert.ok(result.primary_family_candidates.includes("ops"));
});

test("classify deterministic output", () => {
  const result = classifyTaskIntent({
    task_id: "t1", actor_id: "a1", actor_mode: "public",
    intent_key: "k1", task_kind: "ui_fix", goal: "Fix UI regression",
    constraints: [], execution_mode: "fast",
  });
  assert.equal(result.task_kind, "ui_fix");
  assert.ok(result.primary_family_candidates.includes("frontend"));
  assert.ok(result.primary_family_candidates.includes("ops"));
});

test("classify inferred tags", () => {
  const result = classifyTaskIntent({
    task_id: "t2", actor_id: "a2", actor_mode: "creator",
    intent_key: "k2", task_kind: "api_build", goal: "Build API endpoint and test it",
    constraints: [], execution_mode: "safe",
  });
  assert.ok(result.inferred_tags.includes("build"));
  assert.ok(result.inferred_tags.includes("validate"));
});

test("classify multi-family hint", () => {
  const result = classifyTaskIntent({
    task_id: "t3", actor_id: "a3", actor_mode: "creator",
    intent_key: "k3", task_kind: "landing_build", goal: "Build landing page with docs",
    constraints: [], execution_mode: "safe",
  });
  assert.equal(result.execution_hints.multi_family, true);
  assert.equal(result.execution_hints.needs_content, true);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
