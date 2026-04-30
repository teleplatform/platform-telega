import assert from "node:assert/strict";
import { initFsgrRuntime } from "../../packages/fsgr-runtime/src/runtime/initRuntime.js";
import { startFsgrRun } from "../../packages/fsgr-runtime/src/api/startRun.js";
import { resumeFsgrRun } from "../../packages/fsgr-runtime/src/api/resumeRun.js";
import { getFsgrRunExplain } from "../../packages/fsgr-runtime/src/api/getRunExplain.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nIntegration: FSGR Runtime Explain:");

test("explain includes capsule", async () => {
  const runtime = initFsgrRuntime();
  const result = await startFsgrRun(runtime, {
    task_id: "int_explain_1", actor_id: "actor_1", actor_mode: "public",
    intent_key: "build", task_kind: "frontend", goal: "Explain capsule test",
    constraints: [], execution_mode: "fast",
  });
  const explain = getFsgrRunExplain(runtime, result.ledger.run_id) as any;
  assert.equal(explain.ok, true);
  assert.ok(explain.capsule);
});

test("explain includes events", async () => {
  const runtime = initFsgrRuntime();
  const result = await startFsgrRun(runtime, {
    task_id: "int_explain_2", actor_id: "actor_2", actor_mode: "creator",
    intent_key: "build", task_kind: "backend", goal: "Explain events test",
    constraints: [], execution_mode: "safe",
  });
  const explain = getFsgrRunExplain(runtime, result.ledger.run_id) as any;
  assert.ok(explain.node_transitions);
  assert.ok(Array.isArray(explain.node_transitions));
});

test("explain includes run summary", async () => {
  const runtime = initFsgrRuntime();
  const result = await startFsgrRun(runtime, {
    task_id: "int_explain_3", actor_id: "actor_3", actor_mode: "public",
    intent_key: "build", task_kind: "frontend", goal: "Explain summary test",
    constraints: [], execution_mode: "fast",
  });
  const explain = getFsgrRunExplain(runtime, result.ledger.run_id) as any;
  assert.ok(explain.run_summary);
  assert.equal(explain.run_summary.status, "planned");
});

test("explain includes artifact summary", async () => {
  const runtime = initFsgrRuntime();
  const result = await startFsgrRun(runtime, {
    task_id: "int_explain_4", actor_id: "actor_4", actor_mode: "public",
    intent_key: "build", task_kind: "frontend", goal: "Explain artifacts test",
    constraints: [], execution_mode: "fast",
  });
  const explain = getFsgrRunExplain(runtime, result.ledger.run_id) as any;
  assert.ok(explain.artifact_summary);
  assert.ok(Array.isArray(explain.artifact_summary));
});

test("resume run works for degraded run", async () => {
  const runtime = initFsgrRuntime();
  const result = await startFsgrRun(runtime, {
    task_id: "int_explain_5", actor_id: "actor_5", actor_mode: "public",
    intent_key: "build", task_kind: "frontend", goal: "Resume test",
    constraints: [], execution_mode: "fast",
  });
  runtime.ledgerStore.updateRun(result.ledger.run_id, { status: "degraded" });
  const resumeResult = resumeFsgrRun(runtime, result.ledger.run_id);
  assert.equal(resumeResult.status, "running");
  const updated = runtime.ledgerStore.getRun(result.ledger.run_id);
  assert.equal(updated!.status, "running");
});

test("resume run errors for non-paused run", async () => {
  const runtime = initFsgrRuntime();
  const result = await startFsgrRun(runtime, {
    task_id: "int_explain_6", actor_id: "actor_6", actor_mode: "public",
    intent_key: "build", task_kind: "frontend", goal: "Resume error test",
    constraints: [], execution_mode: "fast",
  });
  const resumeResult = resumeFsgrRun(runtime, result.ledger.run_id);
  assert.equal(resumeResult.status, "error");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
