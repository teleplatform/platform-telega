import assert from "node:assert/strict";
import { ALL_HANDOFF_REASONS, isValidHandoffReason, requiresHumanCheckpoint } from "../../../packages/runtime-hitl-core/src/handoff/handoffReasons.js";
import { createHumanHandoffPacket } from "../../../packages/runtime-hitl-core/src/handoff/handoffPacket.js";
import { classifyHandoffContext } from "../../../packages/runtime-hitl-core/src/handoff/handoffClassifier.js";
import { resolveHumanDecision, createHandoff, handoffTask } from "../../../packages/runtime-hitl-core/src/handoff/handoffProtocol.js";

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

test("requiresHumanCheckpoint for high risk", () => {
  assert.equal(requiresHumanCheckpoint({ risk_level: "high" }), true);
});

test("requiresHumanCheckpoint for low risk no checkpoint", () => {
  assert.equal(requiresHumanCheckpoint({ risk_level: "low" }), false);
});

test("requiresHumanCheckpoint for low confidence", () => {
  assert.equal(requiresHumanCheckpoint({ confidence: 0.1 }), true);
});

test("requiresHumanCheckpoint for approval required", () => {
  assert.equal(requiresHumanCheckpoint({ requires_approval: true }), true);
});

console.log("\nHandoff Packet:");

test("createHumanHandoffPacket creates valid packet", () => {
  const packet = createHumanHandoffPacket({ task_id: "task_1", summary: "Needs review", reason_code: "RISK_HIGH" });
  assert.ok(packet.handoff_id.startsWith("handoff_"));
  assert.equal(packet.task_id, "task_1");
  assert.equal(packet.reason_code, "RISK_HIGH");
});

test("packet rejects empty summary", () => {
  assert.throws(() => createHumanHandoffPacket({ task_id: "task_1", summary: "", reason_code: "RISK_HIGH" }));
});

test("packet includes completed_steps", () => {
  const packet = createHumanHandoffPacket({ task_id: "task_1", summary: "Review", completed_steps: ["step1", "step2"], reason_code: "APPROVAL_REQUIRED" });
  assert.equal(packet.completed_steps.length, 2);
});

console.log("\nHandoff Classifier:");

test("high risk classified correctly", () => {
  const result = classifyHandoffContext({ risk_level: "high" });
  assert.equal(result.requires_checkpoint, true);
  assert.equal(result.reason_code, "RISK_HIGH");
});

test("low confidence classified correctly", () => {
  const result = classifyHandoffContext({ confidence: 0.1 });
  assert.equal(result.requires_checkpoint, true);
  assert.equal(result.reason_code, "CONFIDENCE_LOW");
});

test("low risk no checkpoint", () => {
  const result = classifyHandoffContext({ risk_level: "low", confidence: 0.9 });
  assert.equal(result.requires_checkpoint, false);
});

console.log("\nHandoff Protocol:");

test("createHandoff returns valid packet", () => {
  const packet = createHandoff({ task_id: "task_1", summary: "Review needed", reason_code: "APPROVAL_REQUIRED" });
  assert.ok(packet.handoff_id);
});

test("handoffTask transitions to waiting_human", () => {
  const task = { status: "running", task_id: "task_1" };
  const transitionFn = (t: any, s: string) => { t.status = s; return true; };
  const result = handoffTask(task, { task_id: "task_1", summary: "Review", reason_code: "RISK_HIGH" }, transitionFn);
  assert.equal(task.status, "waiting_human");
  assert.ok(result.packet.handoff_id);
});

console.log("\nDecision Resolver:");

test("approve returns running", () => {
  const packet = createHumanHandoffPacket({ task_id: "task_1", summary: "Review", reason_code: "APPROVAL_REQUIRED" });
  const decision = { decision_id: "d1", handoff_id: packet.handoff_id, task_id: "task_1", action: "approve" as const, created_at: new Date().toISOString() };
  const result = resolveHumanDecision(packet, decision);
  assert.equal(result.next_task_status, "running");
  assert.equal(result.next_action, "resume");
});

test("edit returns running with replacement note", () => {
  const packet = createHumanHandoffPacket({ task_id: "task_1", summary: "Review", reason_code: "APPROVAL_REQUIRED" });
  const decision = { decision_id: "d2", handoff_id: packet.handoff_id, task_id: "task_1", action: "edit" as const, editor_notes: "Fixed", replacement_output: "new", created_at: new Date().toISOString() };
  const result = resolveHumanDecision(packet, decision);
  assert.equal(result.next_task_status, "running");
  assert.ok(result.notes.some((n) => n.includes("replacement")));
});

test("reject returns cancelled", () => {
  const packet = createHumanHandoffPacket({ task_id: "task_1", summary: "Review", reason_code: "APPROVAL_REQUIRED" });
  const decision = { decision_id: "d3", handoff_id: packet.handoff_id, task_id: "task_1", action: "reject" as const, created_at: new Date().toISOString() };
  const result = resolveHumanDecision(packet, decision);
  assert.equal(result.next_task_status, "cancelled");
  assert.equal(result.next_action, "cancel");
});

test("reroute returns planning", () => {
  const packet = createHumanHandoffPacket({ task_id: "task_1", summary: "Review", reason_code: "APPROVAL_REQUIRED" });
  const decision = { decision_id: "d4", handoff_id: packet.handoff_id, task_id: "task_1", action: "reroute" as const, reroute_target: "other", created_at: new Date().toISOString() };
  const result = resolveHumanDecision(packet, decision);
  assert.equal(result.next_task_status, "planning");
  assert.equal(result.next_action, "reroute");
});

test("escalate stays waiting_human", () => {
  const packet = createHumanHandoffPacket({ task_id: "task_1", summary: "Review", reason_code: "APPROVAL_REQUIRED" });
  const decision = { decision_id: "d5", handoff_id: packet.handoff_id, task_id: "task_1", action: "escalate" as const, editor_notes: "Escalated", created_at: new Date().toISOString() };
  const result = resolveHumanDecision(packet, decision);
  assert.equal(result.next_task_status, "waiting_human");
  assert.equal(result.next_action, "stay_waiting");
});

test("takeover returns completed", () => {
  const packet = createHumanHandoffPacket({ task_id: "task_1", summary: "Review", reason_code: "APPROVAL_REQUIRED" });
  const decision = { decision_id: "d6", handoff_id: packet.handoff_id, task_id: "task_1", action: "takeover" as const, created_at: new Date().toISOString() };
  const result = resolveHumanDecision(packet, decision);
  assert.equal(result.next_task_status, "completed");
  assert.equal(result.next_action, "manual_takeover");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
