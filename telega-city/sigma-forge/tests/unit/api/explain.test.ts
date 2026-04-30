import assert from "node:assert/strict";
import { initFsgrRuntime } from "../../../packages/fsgr-runtime/src/runtime/initRuntime.js";
import { startFsgrRun } from "../../../packages/fsgr-runtime/src/api/startRun.js";
import { getFsgrRunExplain } from "../../../packages/fsgr-runtime/src/api/getRunExplain.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nAPI explain:");

test("explain includes capsule", async () => {
  const runtime = initFsgrRuntime();
  const result = await startFsgrRun(runtime, {
    task_id: "task_explain_1", actor_id: "actor_1", actor_mode: "public",
    intent_key: "build", task_kind: "frontend", goal: "Test explain capsule",
    constraints: [], execution_mode: "fast",
  });
  const explain = getFsgrRunExplain(runtime, result.ledger.run_id) as any;
  assert.equal(explain.ok, true);
  assert.ok(explain.capsule);
  assert.ok(explain.capsule.goal);
});

test("explain includes events", async () => {
  const runtime = initFsgrRuntime();
  const result = await startFsgrRun(runtime, {
    task_id: "task_explain_2", actor_id: "actor_2", actor_mode: "creator",
    intent_key: "build", task_kind: "backend", goal: "Test explain events",
    constraints: [], execution_mode: "safe",
  });
  const explain = getFsgrRunExplain(runtime, result.ledger.run_id) as any;
  assert.ok(explain.node_transitions);
  assert.ok(Array.isArray(explain.node_transitions));
});

test("explain includes run summary", async () => {
  const runtime = initFsgrRuntime();
  const result = await startFsgrRun(runtime, {
    task_id: "task_explain_3", actor_id: "actor_3", actor_mode: "public",
    intent_key: "build", task_kind: "frontend", goal: "Test explain summary",
    constraints: [], execution_mode: "fast",
  });
  const explain = getFsgrRunExplain(runtime, result.ledger.run_id) as any;
  assert.ok(explain.run_summary);
  assert.equal(explain.run_summary.status, "planned");
  assert.equal(explain.run_summary.total_nodes, 1);
});

test("explain includes artifact summary", async () => {
  const runtime = initFsgrRuntime();
  const result = await startFsgrRun(runtime, {
    task_id: "task_explain_4", actor_id: "actor_4", actor_mode: "public",
    intent_key: "build", task_kind: "frontend", goal: "Test explain artifacts",
    constraints: [], execution_mode: "fast",
  });
  const explain = getFsgrRunExplain(runtime, result.ledger.run_id) as any;
  assert.ok(explain.artifact_summary);
  assert.ok(Array.isArray(explain.artifact_summary));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
