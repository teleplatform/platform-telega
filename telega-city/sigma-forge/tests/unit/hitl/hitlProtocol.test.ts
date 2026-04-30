import assert from "node:assert/strict";
import { createHumanHandoffPacket, resolveHumanDecision, handoffTask, resumeTaskFromDecision, ALL_HANDOFF_REASONS, isValidHandoffReason } from "../../../packages/runtime-task-core/src/hitl/hitlProtocol.js";
import { createAsyncTask } from "../../../packages/runtime-task-core/src/task/taskLifecycle.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nHandoff Reasons:");

test("ALL_HANDOFF_REASONS has 7 reasons", () => {
  assert.equal(ALL_HANDOFF_REASONS.length, 7);
});

test("isValidHandoffReason validates correctly", () => {
  assert.equal(isValidHandoffReason("RISK_HIGH"), true);
  assert.equal(isValidHandoffReason("INVALID"), false);
});

console.log("\nHandoff Packet:");

test("createHumanHandoffPacket creates valid packet", () => {
  const packet = createHumanHandoffPacket({ task_id: "task_1", summary: "Needs review", reason_code: "RISK_HIGH" });
  assert.ok(packet.handoff_id.startsWith("handoff_"));
  assert.equal(packet.task_id, "task_1");
  assert.equal(packet.reason_code, "RISK_HIGH");
});

test("packet includes completed_steps", () => {
  const packet = createHumanHandoffPacket({ task_id: "task_1", summary: "Review", completed_steps: ["step1", "step2"], reason_code: "APPROVAL_REQUIRED" });
  assert.equal(packet.completed_steps.length, 2);
});

console.log("\nDecision Resolver:");

test("approve returns running", () => {
  const packet = createHumanHandoffPacket({ task_id: "task_1", summary: "Review", reason_code: "APPROVAL_REQUIRED" });
  const decision = { decision_id: "d1", handoff_id: packet.handoff_id, task_id: "task_1", action: "approve" as const, created_at: new Date().toISOString() };
  const result = resolveHumanDecision(packet, decision);
  assert.equal(result.next_task_status, "running");
});

test("edit returns running with edits", () => {
  const packet = createHumanHandoffPacket({ task_id: "task_1", summary: "Review", reason_code: "APPROVAL_REQUIRED" });
  const decision = { decision_id: "d2", handoff_id: packet.handoff_id, task_id: "task_1", action: "edit" as const, editor_notes: "Fixed", created_at: new Date().toISOString() };
  const result = resolveHumanDecision(packet, decision);
  assert.equal(result.next_task_status, "running");
  assert.equal(result.next_action, "continue_with_edits");
});

test("reject returns cancelled", () => {
  const packet = createHumanHandoffPacket({ task_id: "task_1", summary: "Review", reason_code: "APPROVAL_REQUIRED" });
  const decision = { decision_id: "d3", handoff_id: packet.handoff_id, task_id: "task_1", action: "reject" as const, created_at: new Date().toISOString() };
  const result = resolveHumanDecision(packet, decision);
  assert.equal(result.next_task_status, "cancelled");
});

test("reroute returns planning", () => {
  const packet = createHumanHandoffPacket({ task_id: "task_1", summary: "Review", reason_code: "APPROVAL_REQUIRED" });
  const decision = { decision_id: "d4", handoff_id: packet.handoff_id, task_id: "task_1", action: "reroute" as const, reroute_target: "other", created_at: new Date().toISOString() };
  const result = resolveHumanDecision(packet, decision);
  assert.equal(result.next_task_status, "planning");
});

test("escalate stays waiting_human", () => {
  const packet = createHumanHandoffPacket({ task_id: "task_1", summary: "Review", reason_code: "APPROVAL_REQUIRED" });
  const decision = { decision_id: "d5", handoff_id: packet.handoff_id, task_id: "task_1", action: "escalate" as const, created_at: new Date().toISOString() };
  const result = resolveHumanDecision(packet, decision);
  assert.equal(result.next_task_status, "waiting_human");
});

test("takeover returns completed", () => {
  const packet = createHumanHandoffPacket({ task_id: "task_1", summary: "Review", reason_code: "APPROVAL_REQUIRED" });
  const decision = { decision_id: "d6", handoff_id: packet.handoff_id, task_id: "task_1", action: "takeover" as const, created_at: new Date().toISOString() };
  const result = resolveHumanDecision(packet, decision);
  assert.equal(result.next_task_status, "completed");
});

console.log("\nHITL Protocol:");

test("handoffTask transitions to waiting_human", () => {
  const task = createAsyncTask({ tele_user_id: "user_1", goal: "Test" });
  task.status = "running";
  const result = handoffTask(task, { summary: "Needs review", reason_code: "RISK_HIGH" });
  assert.equal(task.status, "waiting_human");
  assert.ok(result.packet.handoff_id);
});

test("resumeTaskFromDecision returns to running on approve", () => {
  const task = createAsyncTask({ tele_user_id: "user_1", goal: "Test" });
  task.status = "waiting_human";
  const decision = { decision_id: "d7", handoff_id: "h1", task_id: task.task_id, action: "approve" as const, created_at: new Date().toISOString() };
  const result = resumeTaskFromDecision(task, decision);
  assert.equal(result.next_status, "running");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
