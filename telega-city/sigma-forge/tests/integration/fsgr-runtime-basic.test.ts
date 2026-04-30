import assert from "node:assert/strict";
import { initFsgrRuntime } from "../../packages/fsgr-runtime/src/runtime/initRuntime.js";
import { startFsgrRun } from "../../packages/fsgr-runtime/src/api/startRun.js";
import { getFsgrRun } from "../../packages/fsgr-runtime/src/api/getRun.js";
import { getFsgrRunGraph } from "../../packages/fsgr-runtime/src/api/getRunGraph.js";
import { getFsgrRunExplain } from "../../packages/fsgr-runtime/src/api/getRunExplain.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nIntegration: FSGR Runtime Basic:");

test("init runtime, start run, get run, get graph, get explain", async () => {
  const runtime = initFsgrRuntime();
  const result = await startFsgrRun(runtime, {
    task_id: "int_basic_1", actor_id: "actor_1", actor_mode: "public",
    intent_key: "build", task_kind: "frontend", goal: "Integration basic test",
    constraints: [], execution_mode: "fast",
  });
  assert.ok(result.ledger.run_id);
  assert.ok(result.graph.graph_id);
  assert.ok(result.capsule.capsule_id);

  const run = getFsgrRun(runtime, result.ledger.run_id);
  assert.ok(run);
  assert.equal(run!.status, "planned");

  const graph = getFsgrRunGraph(runtime, result.ledger.run_id);
  assert.ok(graph);
  assert.ok(graph!.nodes.length > 0);

  const explain = getFsgrRunExplain(runtime, result.ledger.run_id) as any;
  assert.equal(explain.ok, true);
  assert.ok(explain.run_summary);
  assert.ok(explain.capsule);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
