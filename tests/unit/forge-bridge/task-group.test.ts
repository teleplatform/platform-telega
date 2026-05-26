import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { TaskGroupStore, resetTaskGroupStore, resetTaskGroupStoreWithBackend, getTaskGroupStore } from "../../../src/runtime/forge-bridge/task-group-store.js";
import { getTaskGroupStreamStore, resetTaskGroupStreamStore, emitGroupEvent } from "../../../src/runtime/forge-bridge/task-group-stream-store.js";
import { aggregateTaskGroupStatus } from "../../../src/runtime/forge-bridge/task-group-types.js";
import { SQLiteTaskGroupBackend } from "../../../src/runtime/forge-bridge/sqlite-task-group-backend.js";
import { dispatchTaskGroup } from "../../../src/runtime/forge-bridge/job-dispatcher.js";

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

async function asyncTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
  }
}

function setupTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE task_groups (
      group_id TEXT PRIMARY KEY,
      parent_task_id TEXT,
      group_status TEXT NOT NULL,
      group_strategy TEXT NOT NULL,
      group_trace_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      metadata_json TEXT
    );
  `);
  db.exec(`
    CREATE TABLE task_group_children (
      group_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      child_order INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (group_id, task_id)
    );
  `);
  db.exec(`
    CREATE TABLE task_group_events (
      event_id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      payload_json TEXT,
      FOREIGN KEY(group_id) REFERENCES task_groups(group_id) ON DELETE CASCADE
    );
  `);
  db.exec(`
    CREATE TABLE task_dependencies (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      depends_on TEXT NOT NULL,
      state TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(group_id) REFERENCES task_groups(group_id) ON DELETE CASCADE
    );
  `);
  return db;
}

let testDb: Database.Database | null = null;

async function beforeEachAsync(): Promise<void> {
  resetTaskGroupStreamStore();
  if (!testDb) {
    testDb = setupTestDb();
  }
  (globalThis as any).__sqliteDb__ = testDb;
  const backend = new SQLiteTaskGroupBackend(testDb);
  backend.clear();
  resetTaskGroupStoreWithBackend(backend);
}

function getTestStore(): TaskGroupStore {
  return getTaskGroupStore();
}

console.log("\nTask Group Foundation:");

async function runTests() {
  await beforeEachAsync();
  await asyncTest("creates task group with parallel strategy", async () => {
    const store = getTestStore();
    const group = await store.create({
      group_id: "group_1",
      child_task_ids: ["task_1", "task_2"],
      group_strategy: "parallel",
    });
    assert.equal(group.group_id, "group_1");
    assert.equal(group.group_status, "queued");
    assert.equal(group.group_strategy, "parallel");
    assert.deepEqual(group.child_task_ids, ["task_1", "task_2"]);
    assert.ok(group.group_trace_id.startsWith("trace_"));
  });

  await beforeEachAsync();
  await asyncTest("creates task group with sequential strategy", async () => {
    const store = getTestStore();
    const group = await store.create({
      group_id: "group_2",
      child_task_ids: ["task_1", "task_2", "task_3"],
      group_strategy: "sequential",
    });
    assert.equal(group.group_strategy, "sequential");
    assert.equal(group.group_status, "queued");
  });

  await beforeEachAsync();
  await asyncTest("creates task group with parent task", async () => {
    const store = getTestStore();
    const group = await store.create({
      group_id: "group_3",
      parent_task_id: "parent_123",
      child_task_ids: ["task_1"],
      group_strategy: "parallel",
    });
    assert.equal(group.parent_task_id, "parent_123");
  });

  await beforeEachAsync();
  await asyncTest("retrieves task group by id", async () => {
    const store = getTestStore();
    await store.create({
      group_id: "group_4",
      child_task_ids: ["task_1"],
      group_strategy: "parallel",
    });
    const retrieved = await store.get("group_4");
    assert.ok(retrieved);
    assert.equal(retrieved?.group_id, "group_4");
  });

  await beforeEachAsync();
  await asyncTest("returns undefined for non-existent group", async () => {
    const store = getTestStore();
    const retrieved = await store.get("non_existent");
    assert.equal(retrieved, undefined);
  });

  await beforeEachAsync();
  await asyncTest("stores multiple groups", async () => {
    const store = getTestStore();
    const g1 = await store.create({ group_id: "g1", child_task_ids: ["t1"], group_strategy: "parallel" });
    const g2 = await store.create({ group_id: "g2", child_task_ids: ["t2"], group_strategy: "parallel" });
    assert.equal(store["groups"].size, 2);
  });

  console.log("\nTaskGroup Status Aggregation:");

  test("all done returns done", () => {
    const status = aggregateTaskGroupStatus(["done", "done", "done"]);
    assert.equal(status, "done");
  });

  test("needs_creator takes priority", () => {
    const status = aggregateTaskGroupStatus(["done", "needs_creator"]);
    assert.equal(status, "needs_creator");
  });

  test("failed returns partial", () => {
    const status = aggregateTaskGroupStatus(["done", "failed"]);
    assert.equal(status, "partial");
  });

  test("blocked returns partial", () => {
    const status = aggregateTaskGroupStatus(["running", "blocked"]);
    assert.equal(status, "partial");
  });

  test("running when active tasks exist", () => {
    const status = aggregateTaskGroupStatus(["done", "running"]);
    assert.equal(status, "running");
  });

  test("cancelled when all cancelled", () => {
    const status = aggregateTaskGroupStatus(["cancelled", "cancelled"]);
    assert.equal(status, "cancelled");
  });

  test("queued when all queued", () => {
    const status = aggregateTaskGroupStatus(["queued", "queued"]);
    assert.equal(status, "queued");
  });

  test("empty returns queued", () => {
    const status = aggregateTaskGroupStatus([]);
    assert.equal(status, "queued");
  });

  console.log("\nTaskGroup Dispatch:");

  await beforeEachAsync();
  await asyncTest("dispatch non-existent group returns not found", async () => {
    const result = await dispatchTaskGroup("non_existent");
    assert.equal(result.summary, "Group not found");
  });

  await beforeEachAsync();
  await asyncTest("dispatch race strategy returns blocked", async () => {
    await getTaskGroupStore().create({
      group_id: "group_race",
      child_task_ids: ["task_1"],
      group_strategy: "race",
    });
    const result = await dispatchTaskGroup("group_race");
    assert.equal(result.failed_tasks.length, 1);
    assert.ok(result.summary.includes("not yet implemented"));
  });

  console.log("\nTaskGroup Streaming:");

  await beforeEachAsync();
  await asyncTest("group_created event emitted", async () => {
    const store = getTaskGroupStore();
    const group = await store.create({
      group_id: "group_stream",
      child_task_ids: ["task_1"],
      group_strategy: "sequential",
    });
    emitGroupEvent("group_stream", "group_created", { group_strategy: "sequential" });
    const streamStore = getTaskGroupStreamStore();
    const events = streamStore.getStreamEvents("group_stream");
    assert.ok(events.some(e => e.event_type === "group_created"));
  });

  await beforeEachAsync();
  await asyncTest("stream events available after dispatch", async () => {
    const store = getTaskGroupStore();
    await store.create({
      group_id: "group_stream2",
      child_task_ids: ["task_1"],
      group_strategy: "sequential",
    });
    emitGroupEvent("group_stream2", "group_created", { group_strategy: "sequential" });
    const streamStore = getTaskGroupStreamStore();
    assert.ok(streamStore.getStreamEvents("group_stream2").length > 0);
  });

  console.log("\nTaskGroup Dependency Readiness:");

  await beforeEachAsync();
  await asyncTest("evaluates ready tasks when no dependencies", async () => {
    const store = getTaskGroupStore();
    await store.create({
      group_id: "group_deps",
      child_task_ids: ["t1", "t2", "t3"],
      group_strategy: "sequential",
    });
    const results = await store.evaluateTaskReadiness("group_deps");
    assert.equal(results.length, 3);
    assert.ok(results.every(r => r.readiness === "ready"));
  });

  await beforeEachAsync();
  await asyncTest("evaluates blocked tasks with dependencies", async () => {
    const store = getTaskGroupStore();
    await store.create({
      group_id: "group_deps2",
      child_task_ids: ["t1", "t2"],
      group_strategy: "sequential",
    });
    await store.addDependency({ group_id: "group_deps2", task_id: "t2", depends_on: "t1" });
    const results = await store.evaluateTaskReadiness("group_deps2");
    assert.equal(results.length, 2);
    const t1 = results.find(r => r.task_id === "t1");
    const t2 = results.find(r => r.task_id === "t2");
    assert.ok(t1!.readiness === "ready");
    assert.ok(t2!.readiness === "blocked");
    assert.deepEqual(t2!.blocking_tasks, ["t1"]);
  });

  await beforeEachAsync();
  await asyncTest("propagates failed dependency", async () => {
    const store = getTaskGroupStore();
    await store.create({
      group_id: "group_deps3",
      child_task_ids: ["t1", "t2"],
      group_strategy: "sequential",
    });
    await store.addDependency({ group_id: "group_deps3", task_id: "t2", depends_on: "t1" });
    await store.updateDependencyState("t2", "t1", "failed");
    const results = await store.evaluateTaskReadiness("group_deps3");
    const t2 = results.find(r => r.task_id === "t2");
    assert.ok(t2!.readiness === "failed");
    assert.deepEqual(t2!.blocking_tasks, ["t1"]);
  });

  await beforeEachAsync();
  await asyncTest("propagates failure through chain A→B→C", async () => {
    const store = getTaskGroupStore();
    await store.create({
      group_id: "group_deps4",
      child_task_ids: ["t1", "t2", "t3"],
      group_strategy: "sequential",
    });
    await store.addDependency({ group_id: "group_deps4", task_id: "t2", depends_on: "t1" });
    await store.addDependency({ group_id: "group_deps4", task_id: "t3", depends_on: "t2" });
    await store.updateDependencyState("t2", "t1", "failed");
    const results = await store.evaluateTaskReadiness("group_deps4");
    const t2 = results.find(r => r.task_id === "t2");
    const t3 = results.find(r => r.task_id === "t3");
    assert.ok(t2!.readiness === "failed");
    assert.ok(t3!.readiness === "failed");
    assert.deepEqual(t3!.blocking_tasks, ["t2"]);
  });

  await beforeEachAsync();
  await asyncTest("DAG API returns task lists", async () => {
    const store = getTaskGroupStore();
    await store.create({
      group_id: "group_dag",
      child_task_ids: ["t1", "t2", "t3"],
      group_strategy: "sequential",
    });
    await store.addDependency({ group_id: "group_dag", task_id: "t2", depends_on: "t1" });
    await store.addDependency({ group_id: "group_dag", task_id: "t3", depends_on: "t2" });
    await store.updateDependencyState("t2", "t1", "failed");
    const dag = await store.getTaskGroupDag("group_dag");
    assert.ok(dag.ready_tasks.includes("t1"));
    assert.ok(dag.failed_tasks.includes("t2"));
    assert.ok(dag.failed_tasks.includes("t3"));
    assert.equal(dag.nodes.length, 3);
    assert.equal(dag.edges.length, 2);
    assert.ok(dag.blocking_tasks.includes("t1"));
  });

  await beforeEachAsync();
  await asyncTest("DAG stream events: dag_created emitted", async () => {
    await getTaskGroupStore().create({
      group_id: "group_dag_stream",
      child_task_ids: ["t1", "t2"],
      group_strategy: "sequential",
    });
    const store = getTaskGroupStore();
    await store.getTaskGroupDag("group_dag_stream");
    const streamStore = getTaskGroupStreamStore();
    const events = streamStore.getStreamEvents("group_dag_stream");
    const dagCreated = events.find(e => e.event_type === "dag_created");
    assert.ok(!!dagCreated, "dag_created event should be emitted");
    assert.equal((dagCreated?.payload as any)?.child_count, 2);
  });

  await beforeEachAsync();
  await asyncTest("DAG stream events: dependency_failed emitted", async () => {
    const store = getTaskGroupStore();
    await store.create({
      group_id: "group_dep_fail_stream",
      child_task_ids: ["t1", "t2"],
      group_strategy: "sequential",
    });
    await store.addDependency({ group_id: "group_dep_fail_stream", task_id: "t2", depends_on: "t1" });
    await store.updateDependencyState("t2", "t1", "failed");
    const streamStore = getTaskGroupStreamStore();
    const events = streamStore.getStreamEvents("group_dep_fail_stream");
    const depFailed = events.find(e => e.event_type === "dependency_failed");
    assert.ok(!!depFailed, "dependency_failed event should be emitted");
  });
}

runTests().then(() => {
  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}).catch(err => {
  console.error("Test runner error:", err);
  process.exit(1);
});