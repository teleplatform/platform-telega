import assert from "node:assert/strict";
import { createTaskDeliveryEnvelope, resolveDeliveryTargets, canDeliverToTarget, deliverTaskResult, VALID_DELIVERY_TARGETS } from "../../../packages/runtime-task-core/src/delivery/deliveryCore.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nDelivery Core:");

test("createTaskDeliveryEnvelope creates valid envelope", () => {
  const envelope = createTaskDeliveryEnvelope({ task_id: "task_1", tele_user_id: "user_1", target: "telegram", payload_summary: "Result ready" });
  assert.ok(envelope.delivery_id.startsWith("delivery_"));
  assert.equal(envelope.status, "pending");
});

test("resolveDeliveryTargets filters valid targets", () => {
  const targets = resolveDeliveryTargets({ delivery_targets: ["telegram", "invalid", "web"] });
  assert.equal(targets.length, 2);
  assert.ok(targets.includes("telegram"));
  assert.ok(targets.includes("web"));
});

test("canDeliverToTarget validates target", () => {
  assert.equal(canDeliverToTarget("telegram"), true);
  assert.equal(canDeliverToTarget("invalid"), false);
});

test("canDeliverToTarget respects compliance", () => {
  assert.equal(canDeliverToTarget("telegram", { allowed: false }), false);
});

test("deliverTaskResult marks as sent", () => {
  const envelopes = [createTaskDeliveryEnvelope({ task_id: "task_1", tele_user_id: "user_1", target: "telegram", payload_summary: "Result" })];
  const delivered = deliverTaskResult(envelopes);
  assert.equal(delivered[0].status, "sent");
});

test("VALID_DELIVERY_TARGETS has 6 targets", () => {
  assert.equal(VALID_DELIVERY_TARGETS.length, 6);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
