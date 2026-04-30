import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createAsyncTask, advanceTaskLifecycle, completeTask } from "../../packages/runtime-task-core/src/task/taskLifecycle.js";
import { createHumanHandoffPacket, handoffTask, resumeTaskFromDecision } from "../../packages/runtime-task-core/src/hitl/hitlProtocol.js";
import { createTaskDeliveryEnvelope, deliverTaskResult } from "../../packages/runtime-task-core/src/delivery/deliveryCore.js";
import { createTasksRepo } from "../../packages/runtime-task-core/src/storage/sqlite/tasksRepo.js";

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
  console.log("\nIntegration: Async Task Create and Run:");

  await test("task created and transitions through lifecycle", () => {
    const task = createAsyncTask({ tele_user_id: "user_1", goal: "Build API", delivery_targets: ["telegram"] });
    assert.equal(task.status, "queued");
    advanceTaskLifecycle(task, "start_planning");
    assert.equal(task.status, "planning");
    advanceTaskLifecycle(task, "start_running");
    assert.equal(task.status, "running");
    completeTask(task);
    assert.equal(task.status, "completed");
  });

  await test("task persisted to DB", () => {
    const db = new Database(":memory:");
    const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "../../packages/runtime-task-core/src/storage/sqlite/schema.sql");
    db.exec(readFileSync(schemaPath, "utf-8"));
    const repo = createTasksRepo(db);
    const task = createAsyncTask({ tele_user_id: "user_1", goal: "Build API" });
    repo.saveTask(task);
    const saved = repo.getTask(task.task_id);
    assert.ok(saved);
    assert.equal(saved!.status, "queued");
  });

  console.log("\nIntegration: Async Task Handoff and Approve:");

  await test("handoff packet created and task transitions", () => {
    const task = createAsyncTask({ tele_user_id: "user_1", goal: "Build API" });
    task.status = "running";
    const result = handoffTask(task, { summary: "Needs approval", reason_code: "APPROVAL_REQUIRED" });
    assert.equal(task.status, "waiting_human");
    assert.ok(result.packet.handoff_id);
  });

  await test("approve decision resumes task", () => {
    const task = createAsyncTask({ tele_user_id: "user_1", goal: "Build API" });
    task.status = "waiting_human";
    const decision = { decision_id: "d1", handoff_id: "h1", task_id: task.task_id, action: "approve" as const, created_at: new Date().toISOString() };
    const result = resumeTaskFromDecision(task, decision);
    assert.equal(result.next_status, "running");
  });

  console.log("\nIntegration: Async Task Handoff and Edit:");

  await test("edit decision resumes with edits", () => {
    const task = createAsyncTask({ tele_user_id: "user_1", goal: "Build API" });
    task.status = "waiting_human";
    const decision = { decision_id: "d2", handoff_id: "h2", task_id: task.task_id, action: "edit" as const, editor_notes: "Fixed output", replacement_output: "new output", created_at: new Date().toISOString() };
    const result = resumeTaskFromDecision(task, decision);
    assert.equal(result.next_status, "running");
    assert.equal(result.action, "continue_with_edits");
  });

  console.log("\nIntegration: Async Task Reroute and Resume:");

  await test("reroute decision returns to planning", () => {
    const task = createAsyncTask({ tele_user_id: "user_1", goal: "Build API" });
    task.status = "waiting_human";
    const decision = { decision_id: "d3", handoff_id: "h3", task_id: task.task_id, action: "reroute" as const, reroute_target: "other_agent", created_at: new Date().toISOString() };
    const result = resumeTaskFromDecision(task, decision);
    assert.equal(result.next_status, "planning");
  });

  console.log("\nIntegration: Async Task Final Delivery:");

  await test("delivery envelopes created and marked sent", () => {
    const task = createAsyncTask({ tele_user_id: "user_1", goal: "Build API", delivery_targets: ["telegram", "web"] });
    const envelopes = task.delivery_targets.map((t) => createTaskDeliveryEnvelope({ task_id: task.task_id, tele_user_id: task.tele_user_id, target: t, payload_summary: "API built successfully" }));
    const delivered = deliverTaskResult(envelopes);
    assert.equal(delivered.length, 2);
    assert.ok(delivered.every((d) => d.status === "sent"));
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
