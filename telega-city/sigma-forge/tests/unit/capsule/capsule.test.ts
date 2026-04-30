import assert from "node:assert/strict";
import { buildContextCapsule } from "../../../packages/fsgr-runtime/src/capsule/capsuleBuilder.js";
import { reduceCapsule } from "../../../packages/fsgr-runtime/src/capsule/capsuleReducer.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nCapsule:");

test("capsule build from ledger + nodes + events", () => {
  const nodes = [
    { node_id: "n1", status: "completed", title: "Build component" },
    { node_id: "n2", status: "failed", title: "Test component" },
    { node_id: "n3", status: "ready", title: "Deploy" },
  ];
  const events = [
    { event_id: "e1", run_id: "r1", event_type: "node.completed" as const, payload: { title: "Build component" }, created_at: "2024-01-01T00:00:00Z", node_id: "n1" },
    { event_id: "e2", run_id: "r1", event_type: "node.failed" as const, payload: { error: "timeout" }, created_at: "2024-01-01T00:01:00Z", node_id: "n2" },
  ];
  const ledger = {
    run_id: "r1", task_id: "task_1", actor_id: "actor_1", actor_mode: "creator",
    status: "degraded" as const, graph_id: "g1", plan_mode: "safe" as const,
    selected_skill_ids: [], current_node_ids: ["n3"], completed_node_ids: ["n1"], failed_node_ids: ["n2"], artifact_ids: [],
    created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:01:00Z",
  };
  const capsule = buildContextCapsule("r1", ledger, nodes, events);
  assert.ok(capsule.capsule_id);
  assert.equal(capsule.run_id, "r1");
  assert.equal(capsule.active_plan_mode, "safe");
  assert.ok(capsule.completed_milestones.includes("Build component"));
  assert.ok(capsule.open_risks.some((r) => r.includes("failed")));
  assert.ok(capsule.open_risks.some((r) => r.includes("degraded")));
  assert.equal(capsule.next_actions[0], "Deploy");
});

test("capsule reduce updates correctly", () => {
  const base = {
    capsule_id: "cap_1", run_id: "r1", goal: "test", active_plan_mode: "safe",
    current_focus: [], completed_milestones: ["M1"], open_risks: [],
    last_decisions: [], evidence_summary: [], next_actions: ["Next"],
    updated_at: "2024-01-01T00:00:00Z",
  };
  const newEvents = [
    { event_id: "e1", run_id: "r1", event_type: "node.completed" as const, payload: { title: "M2" }, created_at: "2024-01-01T00:02:00Z", node_id: "n2" },
    { event_id: "e2", run_id: "r1", event_type: "node.retry_scheduled" as const, payload: { delay: 1000 }, created_at: "2024-01-01T00:03:00Z", node_id: "n3" },
  ];
  const reduced = reduceCapsule(base, newEvents);
  assert.ok(reduced.completed_milestones.includes("M2"));
  assert.equal(reduced.last_decisions.length, 1);
  assert.ok(reduced.updated_at > base.updated_at);
});

test("completed/failed nodes influence summary correctly", () => {
  const nodes = [
    { node_id: "n1", status: "completed", title: "Step 1" },
    { node_id: "n2", status: "completed", title: "Step 2" },
    { node_id: "n3", status: "failed", title: "Step 3" },
  ];
  const events = [
    { event_id: "e1", run_id: "r1", event_type: "node.failed" as const, payload: { error: "crash" }, created_at: "2024-01-01T00:00:00Z", node_id: "n3" },
  ];
  const ledger = {
    run_id: "r1", task_id: "task_1", actor_id: "actor_1", actor_mode: "public",
    status: "degraded" as const, graph_id: "g1", plan_mode: "fast" as const,
    selected_skill_ids: [], current_node_ids: [], completed_node_ids: ["n1", "n2"], failed_node_ids: ["n3"], artifact_ids: [],
    created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
  };
  const capsule = buildContextCapsule("r1", ledger, nodes, events);
  assert.ok(capsule.open_risks.some((r) => r.includes("1 node(s) failed")));
  assert.ok(capsule.open_risks.some((r) => r.includes("degraded")));
  assert.equal(capsule.completed_milestones.length, 2);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
