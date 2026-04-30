import assert from "node:assert/strict";
import { isDuplicateEvent, ensureIdempotentEventAppend } from "../../../packages/fsgr-runtime/src/hardening/idempotency.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nIdempotency:");

test("duplicate event detected", () => {
  const events = [
    { event_id: "e1", run_id: "r1", node_id: "n1", event_type: "node.started", payload: {}, created_at: "2024-01-01T00:00:00Z" },
  ];
  const candidate = { run_id: "r1", node_id: "n1", event_type: "node.started", payload: {} };
  assert.equal(isDuplicateEvent(events as any, candidate as any), true);
});

test("different event not duplicate", () => {
  const events = [
    { event_id: "e1", run_id: "r1", node_id: "n1", event_type: "node.started", payload: {}, created_at: "2024-01-01T00:00:00Z" },
  ];
  const candidate = { run_id: "r1", node_id: "n1", event_type: "node.completed", payload: {} };
  assert.equal(isDuplicateEvent(events as any, candidate as any), false);
});

test("ensureIdempotentEventAppend allows new event", () => {
  const events: any[] = [];
  const candidate = { run_id: "r1", node_id: "n1", event_type: "node.started", payload: {} };
  const result = ensureIdempotentEventAppend(events, candidate as any);
  assert.equal(result.appended, true);
});

test("ensureIdempotentEventAppend denies duplicate", () => {
  const events = [
    { event_id: "e1", run_id: "r1", node_id: "n1", event_type: "node.started", payload: {}, created_at: "2024-01-01T00:00:00Z" },
  ];
  const candidate = { run_id: "r1", node_id: "n1", event_type: "node.started", payload: {} };
  const result = ensureIdempotentEventAppend(events as any, candidate as any);
  assert.equal(result.appended, false);
  assert.equal(result.reason, "duplicate_event");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
