import assert from "node:assert/strict";
import { createAsyncTask, canTaskTransition, transitionTaskStatus, advanceTaskLifecycle, completeTask, failTask, buildTaskSummary } from "../../../packages/runtime-task-core/src/task/taskLifecycle.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nTask Factory:");

test("createAsyncTask creates valid task", () => {
  const task = createAsyncTask({ tele_user_id: "user_1", goal: "Build API" });
  assert.ok(task.task_id.startsWith("task_"));
  assert.equal(task.status, "queued");
  assert.equal(task.tele_user_id, "user_1");
});

test("task has delivery targets", () => {
  const task = createAsyncTask({ tele_user_id: "user_1", goal: "Test", delivery_targets: ["telegram", "web"] });
  assert.equal(task.delivery_targets.length, 2);
});

console.log("\nTask Transitions:");

test("queued -> planning allowed", () => {
  assert.equal(canTaskTransition("queued", "planning"), true);
});

test("planning -> running allowed", () => {
  assert.equal(canTaskTransition("planning", "running"), true);
});

test("running -> waiting_human allowed", () => {
  assert.equal(canTaskTransition("running", "waiting_human"), true);
});

test("running -> completed allowed", () => {
  assert.equal(canTaskTransition("running", "completed"), true);
});

test("completed -> running NOT allowed", () => {
  assert.equal(canTaskTransition("completed", "running"), false);
});

test("queued -> completed NOT allowed", () => {
  assert.equal(canTaskTransition("queued", "completed"), false);
});

test("transitionTaskStatus updates task", () => {
  const task = createAsyncTask({ tele_user_id: "user_1", goal: "Test" });
  assert.equal(transitionTaskStatus(task, "planning"), true);
  assert.equal(task.status, "planning");
});

test("transitionTaskStatus rejects invalid transition", () => {
  const task = createAsyncTask({ tele_user_id: "user_1", goal: "Test" });
  assert.equal(transitionTaskStatus(task, "completed"), false);
  assert.equal(task.status, "queued");
});

console.log("\nTask Lifecycle:");

test("advanceTaskLifecycle works", () => {
  const task = createAsyncTask({ tele_user_id: "user_1", goal: "Test" });
  advanceTaskLifecycle(task, "start_planning");
  assert.equal(task.status, "planning");
  advanceTaskLifecycle(task, "start_running");
  assert.equal(task.status, "running");
  completeTask(task);
  assert.equal(task.status, "completed");
});

test("failTask transitions correctly", () => {
  const task = createAsyncTask({ tele_user_id: "user_1", goal: "Test" });
  advanceTaskLifecycle(task, "start_planning");
  advanceTaskLifecycle(task, "start_running");
  failTask(task, "error");
  assert.equal(task.status, "failed");
});

test("buildTaskSummary returns readable string", () => {
  const task = createAsyncTask({ tele_user_id: "user_1", goal: "Build API endpoint with validation" });
  const summary = buildTaskSummary(task);
  assert.ok(summary.includes("queued"));
  assert.ok(summary.includes("Build API"));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
