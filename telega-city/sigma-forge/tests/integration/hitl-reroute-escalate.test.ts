import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createHumanHandoffPacket, resolveHumanDecision, handoffTask } from "../../packages/runtime-hitl-core/src/handoff/handoffProtocol.js";
import { validateHumanDecision } from "../../packages/runtime-hitl-core/src/decision/decisionValidation.js";
import { resolveResumePath } from "../../packages/runtime-hitl-core/src/resume/resumeResolver.js";
import { resumeTaskFromDecision } from "../../packages/runtime-hitl-core/src/resume/runtimeResume.js";
import { createHandoffsRepo, createDecisionsRepo, createDeliveriesRepo } from "../../packages/runtime-task-core/src/storage/sqlite/handoffsRepo.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.then(() => { passed++; console.log(`  ✓ ${name}`); }).catch((e) => { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); });
    }
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`  ✗ ${name}\n    ${e.message}`);
  }
}

async function runTests() {
  const db = new Database(":memory:");
  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "../../packages/runtime-task-core/src/storage/sqlite/schema.sql");
  db.exec(readFileSync(schemaPath, "utf-8"));
  const handoffsRepo = createHandoffsRepo(db);
  const decisionsRepo = createDecisionsRepo(db);
  const deliveriesRepo = createDeliveriesRepo(db);

  console.log("\nIntegration: HITL Create Handoff:");

  await test("handoff packet created and persisted", () => {
    const packet = createHumanHandoffPacket({ task_id: "task_1", summary: "Needs approval", reason_code: "APPROVAL_REQUIRED" });
    handoffsRepo.saveHandoff(packet);
    const saved = handoffsRepo.getHandoff(packet.handoff_id);
    assert.ok(saved);
    assert.equal(saved!.reason_code, "APPROVAL_REQUIRED");
  });

  await test("handoff transitions task to waiting_human", () => {
    const task = { status: "running", task_id: "task_2" };
    const transitionFn = (t: any, s: string) => { t.status = s; return true; };
    const result = handoffTask(task, { task_id: "task_2", summary: "Review", reason_code: "RISK_HIGH" }, transitionFn);
    assert.equal(task.status, "waiting_human");
    assert.ok(result.packet.handoff_id);
  });

  console.log("\nIntegration: HITL Approve Resume:");

  await test("approve decision validates and resolves", () => {
    const packet = createHumanHandoffPacket({ task_id: "task_3", summary: "Review", reason_code: "APPROVAL_REQUIRED" });
    const decision = { decision_id: "d1", handoff_id: packet.handoff_id, task_id: "task_3", action: "approve" as const, created_at: new Date().toISOString() };
    const validation = validateHumanDecision(packet, decision);
    assert.equal(validation.valid, true);
    const resolution = resolveHumanDecision(packet, decision);
    assert.equal(resolution.next_task_status, "running");
  });

  await test("approve decision persisted and resume works", () => {
    const packet = createHumanHandoffPacket({ task_id: "task_4", summary: "Review", reason_code: "APPROVAL_REQUIRED" });
    handoffsRepo.saveHandoff(packet);
    const decision = { decision_id: "d2", handoff_id: packet.handoff_id, task_id: "task_4", action: "approve" as const, created_at: new Date().toISOString() };
    decisionsRepo.saveDecision(decision);
    const resolution = resolveHumanDecision(packet, decision);
    const task = { status: "waiting_human", task_id: "task_4" };
    const transitionFn = (t: any, s: string) => { t.status = s; return true; };
    const resumeResult = resumeTaskFromDecision(task, resolution, transitionFn);
    assert.equal(resumeResult.resumed, true);
    assert.equal(task.status, "running");
  });

  console.log("\nIntegration: HITL Edit Resume:");

  await test("edit decision injects replacement output", () => {
    const packet = createHumanHandoffPacket({ task_id: "task_5", summary: "Review", reason_code: "APPROVAL_REQUIRED" });
    const decision = { decision_id: "d3", handoff_id: packet.handoff_id, task_id: "task_5", action: "edit" as const, editor_notes: "Fixed", replacement_output: "new output", created_at: new Date().toISOString() };
    const validation = validateHumanDecision(packet, decision);
    assert.equal(validation.valid, true);
    const resolution = resolveHumanDecision(packet, decision);
    assert.ok(resolution.notes.some((n) => n.includes("replacement")));
  });

  console.log("\nIntegration: HITL Reject Cancel:");

  await test("reject decision cancels task", () => {
    const packet = createHumanHandoffPacket({ task_id: "task_6", summary: "Review", reason_code: "APPROVAL_REQUIRED" });
    const decision = { decision_id: "d4", handoff_id: packet.handoff_id, task_id: "task_6", action: "reject" as const, created_at: new Date().toISOString() };
    const resolution = resolveHumanDecision(packet, decision);
    assert.equal(resolution.next_task_status, "cancelled");
    assert.equal(resolution.next_action, "cancel");
  });

  await test("edit without replacement_output rejected", () => {
    const packet = createHumanHandoffPacket({ task_id: "task_7", summary: "Review", reason_code: "APPROVAL_REQUIRED" });
    const decision = { decision_id: "d5", handoff_id: packet.handoff_id, task_id: "task_7", action: "edit" as const, created_at: new Date().toISOString() };
    const validation = validateHumanDecision(packet, decision);
    assert.equal(validation.valid, false);
    assert.ok(validation.errors[0].includes("replacement_output"));
  });

  console.log("\nIntegration: HITL Reroute Escalate:");

  await test("reroute decision returns to planning", () => {
    const packet = createHumanHandoffPacket({ task_id: "task_8", summary: "Review", reason_code: "APPROVAL_REQUIRED" });
    const decision = { decision_id: "d6", handoff_id: packet.handoff_id, task_id: "task_8", action: "reroute" as const, reroute_target: "other_agent", created_at: new Date().toISOString() };
    const validation = validateHumanDecision(packet, decision);
    assert.equal(validation.valid, true);
    const resolution = resolveHumanDecision(packet, decision);
    assert.equal(resolution.next_task_status, "planning");
  });

  await test("escalate without notes rejected", () => {
    const packet = createHumanHandoffPacket({ task_id: "task_9", summary: "Review", reason_code: "APPROVAL_REQUIRED" });
    const decision = { decision_id: "d7", handoff_id: packet.handoff_id, task_id: "task_9", action: "escalate" as const, created_at: new Date().toISOString() };
    const validation = validateHumanDecision(packet, decision);
    assert.equal(validation.valid, false);
  });

  await test("escalate with notes stays waiting_human", () => {
    const packet = createHumanHandoffPacket({ task_id: "task_10", summary: "Review", reason_code: "APPROVAL_REQUIRED" });
    const decision = { decision_id: "d8", handoff_id: packet.handoff_id, task_id: "task_10", action: "escalate" as const, editor_notes: "Escalated to manager", created_at: new Date().toISOString() };
    const validation = validateHumanDecision(packet, decision);
    assert.equal(validation.valid, true);
    const resolution = resolveHumanDecision(packet, decision);
    assert.equal(resolution.next_task_status, "waiting_human");
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
