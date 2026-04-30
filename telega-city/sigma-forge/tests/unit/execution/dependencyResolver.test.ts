import assert from "node:assert/strict";
import { areDependenciesSatisfied, getReadyNodes, getBlockingDependencies } from "../../../packages/fsgr-runtime/src/execution/dependencyResolver.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nDependency Resolver:");

test("no dependencies = satisfied", () => {
  const node = { node_id: "n1", dependency_ids: [] };
  assert.equal(areDependenciesSatisfied(node as any, []), true);
});

test("all dependencies completed = satisfied", () => {
  const nodes = [
    { node_id: "n1", status: "completed", dependency_ids: [] },
    { node_id: "n2", status: "completed", dependency_ids: ["n1"] },
  ];
  assert.equal(areDependenciesSatisfied(nodes[1] as any, nodes as any), true);
});

test("pending dependency = not satisfied", () => {
  const nodes = [
    { node_id: "n1", status: "ready", dependency_ids: [] },
    { node_id: "n2", status: "waiting_dependency", dependency_ids: ["n1"] },
  ];
  assert.equal(areDependenciesSatisfied(nodes[1] as any, nodes as any), false);
});

test("getReadyNodes returns ready and satisfied waiting_dependency", () => {
  const nodes = [
    { node_id: "n1", status: "completed", dependency_ids: [] },
    { node_id: "n2", status: "waiting_dependency", dependency_ids: ["n1"] },
    { node_id: "n3", status: "ready", dependency_ids: [] },
  ];
  const ready = getReadyNodes(nodes as any);
  assert.equal(ready.length, 2);
  assert.ok(ready.find((n) => n.node_id === "n2"));
  assert.ok(ready.find((n) => n.node_id === "n3"));
});

test("getBlockingDependencies returns incomplete deps", () => {
  const nodes = [
    { node_id: "n1", status: "ready", dependency_ids: [] },
    { node_id: "n2", status: "waiting_dependency", dependency_ids: ["n1", "n3"] },
    { node_id: "n3", status: "waiting_dependency", dependency_ids: [] },
  ];
  const blocking = getBlockingDependencies(nodes[1] as any, nodes as any);
  assert.equal(blocking.length, 2); // n1 and n3 are not completed
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
