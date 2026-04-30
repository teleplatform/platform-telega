import assert from "node:assert/strict";
import { initFsgrRuntime } from "../../packages/fsgr-runtime/src/runtime/initRuntime.js";
import { startFsgrRun } from "../../packages/fsgr-runtime/src/api/startRun.js";
import { retryFsgrNode } from "../../packages/fsgr-runtime/src/api/retryNode.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nIntegration: FSGR Runtime Retry:");

test("failed node retry works", async () => {
  const runtime = initFsgrRuntime();
  const result = await startFsgrRun(runtime, {
    task_id: "int_retry_1", actor_id: "actor_1", actor_mode: "public",
    intent_key: "build", task_kind: "frontend", goal: "Retry test",
    constraints: [], execution_mode: "fast",
  });

  const runId = result.ledger.run_id;
  const nodes = runtime.ledgerStore.getNodes(runId);
  const nodeId = nodes[0].node_id;

  runtime.ledgerStore.updateNode(nodeId, { status: "failed" });

  const retryResult = retryFsgrNode(runtime, runId, nodeId);
  assert.equal(retryResult.status, "scheduled");

  const updatedNodes = runtime.ledgerStore.getNodes(runId);
  const updatedNode = updatedNodes.find((n: any) => n.node_id === nodeId);
  assert.equal(updatedNode.status, "ready");

  const events = runtime.ledgerStore.getEvents(runId);
  assert.ok(events.some((e) => e.event_type === "node.retry_scheduled"));
});

test("retry non-failed node returns error", async () => {
  const runtime = initFsgrRuntime();
  const result = await startFsgrRun(runtime, {
    task_id: "int_retry_2", actor_id: "actor_2", actor_mode: "public",
    intent_key: "build", task_kind: "frontend", goal: "Retry error test",
    constraints: [], execution_mode: "fast",
  });

  const runId = result.ledger.run_id;
  const nodes = runtime.ledgerStore.getNodes(runId);
  const nodeId = nodes[0].node_id;

  const retryResult = retryFsgrNode(runtime, runId, nodeId);
  assert.equal(retryResult.status, "error");
  assert.ok(retryResult.error?.includes("not failed"));
});

test("retry unknown node returns error", async () => {
  const runtime = initFsgrRuntime();
  const result = await startFsgrRun(runtime, {
    task_id: "int_retry_3", actor_id: "actor_3", actor_mode: "public",
    intent_key: "build", task_kind: "frontend", goal: "Retry unknown test",
    constraints: [], execution_mode: "fast",
  });

  const retryResult = retryFsgrNode(runtime, result.ledger.run_id, "unknown_node");
  assert.equal(retryResult.status, "error");
  assert.ok(retryResult.error?.includes("not found"));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
