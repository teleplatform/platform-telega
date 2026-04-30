import assert from "node:assert/strict";
import { initSqliteFsgrDb } from "../../../packages/fsgr-runtime/src/storage/sqlite/db.js";
import { createRepos } from "../../../packages/fsgr-runtime/src/storage/sqlite/index.js";
import { createLedgerStore } from "../../../packages/fsgr-runtime/src/ledger/ledgerStore.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nLedger Store:");

test("create/update/get run", () => {
  const db = initSqliteFsgrDb();
  const repos = createRepos(db);
  const store = createLedgerStore({ repos });
  const now = new Date().toISOString();
  store.createRun({
    run_id: "run_ledger_1", task_id: "task_1", actor_id: "actor_1", actor_mode: "public",
    status: "planned", graph_id: "graph_1", plan_mode: "fast",
    selected_skill_ids: [], current_node_ids: [], completed_node_ids: [], failed_node_ids: [], artifact_ids: [],
    created_at: now, updated_at: now,
  });
  const run = store.getRun("run_ledger_1");
  assert.ok(run);
  assert.equal(run!.status, "planned");
  store.updateRun("run_ledger_1", { status: "running" });
  const updated = store.getRun("run_ledger_1");
  assert.equal(updated!.status, "running");
});

test("append/get events", () => {
  const db = initSqliteFsgrDb();
  const repos = createRepos(db);
  const store = createLedgerStore({ repos });
  const now = new Date().toISOString();
  store.createRun({
    run_id: "run_ledger_2", task_id: "task_2", actor_id: "actor_2", actor_mode: "creator",
    status: "planned", graph_id: "graph_2", plan_mode: "safe",
    selected_skill_ids: [], current_node_ids: [], completed_node_ids: [], failed_node_ids: [], artifact_ids: [],
    created_at: now, updated_at: now,
  });
  store.appendEvent({ run_id: "run_ledger_2", event_type: "run.created", payload: { test: true } });
  store.appendEvent({ run_id: "run_ledger_2", node_id: "node_1", event_type: "node.started", payload: {} });
  const events = store.getEvents("run_ledger_2");
  assert.equal(events.length, 2);
  assert.equal(events[0].event_type, "run.created");
  assert.equal(events[1].event_type, "node.started");
});

test("getNodes returns nodes for run", () => {
  const db = initSqliteFsgrDb();
  const repos = createRepos(db);
  const store = createLedgerStore({ repos });
  const now = new Date().toISOString();
  store.createRun({
    run_id: "run_ledger_3", task_id: "task_3", actor_id: "actor_3", actor_mode: "public",
    status: "planned", graph_id: "graph_3", plan_mode: "fast",
    selected_skill_ids: [], current_node_ids: [], completed_node_ids: [], failed_node_ids: [], artifact_ids: [],
    created_at: now, updated_at: now,
  });
  repos.nodes.createNodes([{
    node_id: "node_1", run_id: "run_ledger_3", skill_id: "bootstrap", title: "Test",
    status: "ready", dependency_ids: [], input_refs: [], output_refs: [],
    validator_hooks: [], retry_count: 0, max_retries: 2, risk_class: "low",
  }]);
  const nodes = store.getNodes("run_ledger_3");
  assert.equal(nodes.length, 1);
});

test("save/get capsule", () => {
  const db = initSqliteFsgrDb();
  const repos = createRepos(db);
  const store = createLedgerStore({ repos });
  const now = new Date().toISOString();
  store.createRun({
    run_id: "run_ledger_4", task_id: "task_4", actor_id: "actor_4", actor_mode: "public",
    status: "planned", graph_id: "graph_4", plan_mode: "fast",
    selected_skill_ids: [], current_node_ids: [], completed_node_ids: [], failed_node_ids: [], artifact_ids: [],
    created_at: now, updated_at: now,
  });
  store.saveCapsule({ capsule_id: "cap_1", run_id: "run_ledger_4", capsule_json: JSON.stringify({ goal: "test" }) });
  const capsule = store.getCapsule("run_ledger_4");
  assert.ok(capsule);
  assert.equal(capsule.capsule_id, "cap_1");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
