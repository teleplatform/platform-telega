import assert from "node:assert/strict";
import { projectTaskGroupMissionMessage } from "../../../src/runtime/mission-control/task-group-mission.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
  }
}

console.log("\nTaskGroup Mission Control Projection:");

test("projects group_created message", () => {
  const msg = projectTaskGroupMissionMessage({
    stream_id: "tgs_1",
    group_id: "group_1",
    sequence: 1,
    event_type: "group_created",
    timestamp: Date.now(),
    payload: { group_strategy: "parallel" },
  });
  assert.ok(msg.includes("parallel"));
});

test("projects child_task_completed message", () => {
  const msg = projectTaskGroupMissionMessage({
    stream_id: "tgs_1",
    group_id: "group_1",
    sequence: 2,
    event_type: "child_task_completed",
    timestamp: Date.now(),
    payload: { task_id: "task_1", status: "done" },
  });
  assert.ok(msg.includes("task_1"));
  assert.ok(msg.includes("done"));
});

test("projects group_done message", () => {
  const msg = projectTaskGroupMissionMessage({
    stream_id: "tgs_1",
    group_id: "group_1",
    sequence: 3,
    event_type: "group_done",
    timestamp: Date.now(),
    payload: { dispatched_count: 5 },
  });
  assert.ok(msg.includes("completed"));
});

test("projects group_failed message", () => {
  const msg = projectTaskGroupMissionMessage({
    stream_id: "tgs_1",
    group_id: "group_1",
    sequence: 4,
    event_type: "group_failed",
    timestamp: Date.now(),
    payload: { reason: "timeout" },
  });
  assert.ok(msg.includes("failed"));
});

test("projects group_cancelled message", () => {
  const msg = projectTaskGroupMissionMessage({
    stream_id: "tgs_1",
    group_id: "group_1",
    sequence: 5,
    event_type: "group_cancelled",
    timestamp: Date.now(),
    payload: { reason: "creator request" },
  });
  assert.ok(msg.includes("cancelled"));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);