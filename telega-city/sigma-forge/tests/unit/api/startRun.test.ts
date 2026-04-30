import assert from "node:assert/strict";
import { initFsgrRuntime } from "../../../packages/fsgr-runtime/src/runtime/initRuntime.js";
import { startFsgrRun } from "../../../packages/fsgr-runtime/src/api/startRun.js";
import { getFsgrRun } from "../../../packages/fsgr-runtime/src/api/getRun.js";
import { getFsgrRunGraph } from "../../../packages/fsgr-runtime/src/api/getRunGraph.js";
import { getFsgrRunExplain } from "../../../packages/fsgr-runtime/src/api/getRunExplain.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nAPI startRun:");

test("start run creates ledger, graph, capsule, events", async () => {
  const runtime = initFsgrRuntime();
  const result = await startFsgrRun(runtime, {
    task_id: "task_1", actor_id: "actor_1", actor_mode: "public",
    intent_key: "build", task_kind: "frontend", goal: "Build a component",
    constraints: [], execution_mode: "fast",
  });
  assert.ok(result.ledger);
  assert.ok(result.ledger.run_id);
  assert.equal(result.ledger.status, "planned");
  assert.ok(result.graph);
  assert.equal(result.graph.nodes.length, 1);
  assert.ok(result.capsule);
  assert.ok(result.capsule.capsule_id);

  const events = runtime.ledgerStore.getEvents(result.ledger.run_id);
  assert.ok(events.some((e) => e.event_type === "run.created"));
  assert.ok(events.some((e) => e.event_type === "plan.built"));
  assert.ok(events.some((e) => e.event_type === "capsule.updated"));
});

console.log("\nAPI explain:");

test("explain built from ledger/events/capsule", async () => {
  const runtime = initFsgrRuntime();
  const result = await startFsgrRun(runtime, {
    task_id: "task_2", actor_id: "actor_2", actor_mode: "creator",
    intent_key: "build", task_kind: "backend", goal: "Build API",
    constraints: [], execution_mode: "safe",
  });
  const explain = getFsgrRunExplain(runtime, result.ledger.run_id);
  assert.equal((explain as any).ok, true);
  assert.ok((explain as any).run_summary);
  assert.ok((explain as any).node_transitions);
  assert.ok((explain as any).capsule);
  assert.ok((explain as any).artifact_summary);
  assert.ok((explain as any).explain_summary);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
