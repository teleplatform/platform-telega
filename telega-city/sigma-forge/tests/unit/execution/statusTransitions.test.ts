import assert from "node:assert/strict";
import { canTransition, transitionNodeStatus, deriveRunStatus } from "../../../packages/fsgr-runtime/src/execution/statusTransitions.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nStatus Transitions:");

test("ready -> running allowed", () => {
  assert.equal(canTransition("ready", "running"), true);
});

test("running -> completed allowed", () => {
  assert.equal(canTransition("running", "completed"), true);
});

test("running -> failed allowed", () => {
  assert.equal(canTransition("running", "failed"), true);
});

test("failed -> ready allowed (retry)", () => {
  assert.equal(canTransition("failed", "ready"), true);
});

test("waiting_dependency -> ready allowed", () => {
  assert.equal(canTransition("waiting_dependency", "ready"), true);
});

test("completed -> running NOT allowed", () => {
  assert.equal(canTransition("completed", "running"), false);
});

test("transitionNodeStatus updates node", () => {
  const node = { node_id: "n1", status: "ready" };
  const result = transitionNodeStatus(node as any, "running");
  assert.equal(result, true);
  assert.equal(node.status, "running");
});

test("transitionNodeStatus rejects invalid transition", () => {
  const node = { node_id: "n2", status: "completed" };
  const result = transitionNodeStatus(node as any, "running");
  assert.equal(result, false);
  assert.equal(node.status, "completed");
});

test("deriveRunStatus: all completed -> completed", () => {
  const nodes = [
    { node_id: "n1", status: "completed" },
    { node_id: "n2", status: "completed" },
  ];
  assert.equal(deriveRunStatus(nodes as any, "running"), "completed");
});

test("deriveRunStatus: some failed, some running -> degraded", () => {
  const nodes = [
    { node_id: "n1", status: "completed" },
    { node_id: "n2", status: "failed" },
    { node_id: "n3", status: "running" },
  ];
  assert.equal(deriveRunStatus(nodes as any, "running"), "degraded");
});

test("deriveRunStatus: all failed -> failed", () => {
  const nodes = [
    { node_id: "n1", status: "failed" },
    { node_id: "n2", status: "failed" },
  ];
  assert.equal(deriveRunStatus(nodes as any, "running"), "failed");
});

test("deriveRunStatus: has active nodes -> running", () => {
  const nodes = [
    { node_id: "n1", status: "ready" },
    { node_id: "n2", status: "waiting_dependency" },
  ];
  assert.equal(deriveRunStatus(nodes as any, "running"), "running");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
