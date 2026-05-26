import assert from "node:assert/strict";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SQLiteTaskGroupBackend } from "../../src/runtime/forge-bridge/sqlite-task-group-backend.js";
import { getTaskGroupStreamStore, resetTaskGroupStreamStore } from "../../src/runtime/forge-bridge/task-group-stream-store.js";

const TEST_DB_PATH = "/Volumes/AI_DRIVE/telecache/tmp/kilo/taskgroup-recovery-test.sqlite";

function setupTestDb(): Database.Database {
  fs.mkdirSync(path.dirname(TEST_DB_PATH), { recursive: true });
  const db = new Database(TEST_DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_groups (
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
    CREATE TABLE IF NOT EXISTS task_group_children (
      group_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      child_order INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (group_id, task_id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS task_group_events (
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
    CREATE TABLE IF NOT EXISTS task_dependencies (
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

function cleanupTestDb() {
  try {
    fs.unlinkSync(TEST_DB_PATH);
    fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    fs.unlinkSync(`${TEST_DB_PATH}-shm`);
  } catch {
    // ignore
  }
}

async function runRecoverySmoke() {
  console.log("\nKCA-15.10 Recovery Smoke:\n");

  cleanupTestDb();
  const db = setupTestDb();
  
  const backend = new SQLiteTaskGroupBackend(db);

  // Step 1: Create group
  console.log("  1. Creating group...");
  const group = await backend.createGroup({
    group_id: "group_recovery_test",
    child_task_ids: ["child_1", "child_2", "child_3"],
    group_strategy: "parallel",
  });
  assert.equal(group.group_status, "queued");
  console.log("     ✓ Group created");

  // Step 2: Add child tasks
  console.log("  2. Adding child tasks...");
  await backend.addChild("group_recovery_test", "child_4");
  const children = await backend.listChildren("group_recovery_test");
  assert.deepEqual(children, ["child_1", "child_2", "child_3", "child_4"]);
  console.log("     ✓ Children added");

  // Step 3: Emit group events
  console.log("  3. Emitting group events...");
  await backend.appendGroupEvent({
    group_id: "group_recovery_test",
    event_type: "group_created",
    payload: { strategy: "parallel" },
  });
  await backend.appendGroupEvent({
    group_id: "group_recovery_test",
    event_type: "child_task_started",
    payload: { task_id: "child_1" },
  });
  console.log("     ✓ Events emitted");

  // Step 4: Simulate store reload (close and reopen)
  console.log("  4. Simulating store reload...");
  db.close();
  
  // Reopen database (simulates restart)
  const db2 = setupTestDb();
  const backend2 = new SQLiteTaskGroupBackend(db2);
  console.log("     ✓ Store reloaded");

  // Step 5: Get group
  console.log("  5. Reading group after reload...");
  const loadedGroup = await backend2.getGroup("group_recovery_test");
  assert.ok(loadedGroup, "Group should exist after reload");
  assert.equal(loadedGroup!.group_status, "queued");
  assert.equal(loadedGroup!.group_strategy, "parallel");
  console.log("     ✓ Group persisted");

  // Step 6: Get children
  console.log("  6. Reading children after reload...");
  const loadedChildren = await backend2.listChildren("group_recovery_test");
  assert.deepEqual(loadedChildren, ["child_1", "child_2", "child_3", "child_4"]);
  console.log("     ✓ Children persisted");

  // Step 7: Get stream events
  console.log("  7. Reading stream events after reload...");
  const events = await backend2.listGroupEvents("group_recovery_test");
  assert.equal(events.length, 2);
  assert.equal(events[0].event_type, "group_created");
  assert.equal(events[1].event_type, "child_task_started");
  console.log("     ✓ Events persisted");

  // Step 8: Verify sequence continuity
  console.log("  8. Verifying sequence continuity...");
  assert.equal(events[0].sequence, 1);
  assert.equal(events[1].sequence, 2);
  console.log("     ✓ Sequence continuous");

  db2.close();
  cleanupTestDb();

  console.log("\n✅ All recovery smoke tests passed\n");
  console.log("KCA-15.9 fully verified: persistence works after restart\n");
}

runRecoverySmoke().catch((e) => {
  console.error("Recovery smoke failed:", e);
  process.exit(1);
});