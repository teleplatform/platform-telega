import assert from "node:assert/strict";
import { validateEventSequence, ensureRunLifecycleEvents, ensureNodeLifecycleEvents } from "../../../packages/fsgr-runtime/src/hardening/eventIntegrity.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nEvent Integrity:");

test("valid sequence accepted", () => {
  const events = [
    { event_id: "e1", run_id: "r1", event_type: "run.created", payload: {}, created_at: "2024-01-01T00:00:00Z" },
    { event_id: "e2", run_id: "r1", event_type: "plan.built", payload: {}, created_at: "2024-01-01T00:00:01Z" },
    { event_id: "e3", run_id: "r1", node_id: "n1", event_type: "node.started", payload: {}, created_at: "2024-01-01T00:00:02Z" },
    { event_id: "e4", run_id: "r1", node_id: "n1", event_type: "node.completed", payload: {}, created_at: "2024-01-01T00:00:03Z" },
  ];
  const result = validateEventSequence(events as any);
  assert.equal(result.ok, true);
});

test("missing run.created rejected", () => {
  const events = [
    { event_id: "e1", run_id: "r1", event_type: "plan.built", payload: {}, created_at: "2024-01-01T00:00:01Z" },
  ];
  const result = validateEventSequence(events as any);
  assert.equal(result.ok, false);
});

test("node.completed before node.started rejected", () => {
  const events = [
    { event_id: "e1", run_id: "r1", event_type: "run.created", payload: {}, created_at: "2024-01-01T00:00:00Z" },
    { event_id: "e2", run_id: "r1", event_type: "plan.built", payload: {}, created_at: "2024-01-01T00:00:01Z" },
    { event_id: "e3", run_id: "r1", node_id: "n1", event_type: "node.completed", payload: {}, created_at: "2024-01-01T00:00:02Z" },
  ];
  const result = validateEventSequence(events as any);
  assert.equal(result.ok, false);
});

test("ensureRunLifecycleEvents detects missing events", () => {
  const events = [
    { event_id: "e1", run_id: "r1", event_type: "run.created", payload: {}, created_at: "2024-01-01T00:00:00Z" },
  ];
  const result = ensureRunLifecycleEvents(events as any);
  assert.equal(result.ok, false);
  assert.ok(result.missing.includes("plan.built"));
});

test("ensureNodeLifecycleEvents detects missing events", () => {
  const events = [
    { event_id: "e1", run_id: "r1", node_id: "n1", event_type: "node.started", payload: {}, created_at: "2024-01-01T00:00:00Z" },
  ];
  const result = ensureNodeLifecycleEvents(events as any, "n1");
  assert.equal(result.ok, false);
  assert.ok(result.missing.includes("node.completed"));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
