import assert from "node:assert/strict";
import { initSqliteFsgrDb } from "../../../packages/fsgr-runtime/src/storage/sqlite/db.js";
import { createRepos } from "../../../packages/fsgr-runtime/src/storage/sqlite/index.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nStorage Repos:");

test("schema applied successfully", () => {
  const db = initSqliteFsgrDb();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
  const tableNames = tables.map((t) => t.name);
  assert.ok(tableNames.includes("fsgr_runs"));
  assert.ok(tableNames.includes("fsgr_nodes"));
  assert.ok(tableNames.includes("fsgr_artifacts"));
  assert.ok(tableNames.includes("fsgr_capsules"));
  assert.ok(tableNames.includes("fsgr_events"));
});

test("run create/get/update", () => {
  const db = initSqliteFsgrDb();
  const repos = createRepos(db);
  const now = new Date().toISOString();
  repos.runs.createRun({
    run_id: "run_test_1", task_id: "task_1", actor_id: "actor_1", actor_mode: "public",
    status: "planned", graph_id: "graph_1", plan_mode: "fast",
    selected_skill_ids: [], current_node_ids: [], completed_node_ids: [], failed_node_ids: [], artifact_ids: [],
    created_at: now, updated_at: now,
  });
  const run = repos.runs.getRunById("run_test_1");
  assert.ok(run);
  assert.equal(run!.run_id, "run_test_1");
  repos.runs.updateRun("run_test_1", { status: "running" });
  const updated = repos.runs.getRunById("run_test_1");
  assert.equal(updated!.status, "running");
});

test("node create/get/update", () => {
  const db = initSqliteFsgrDb();
  const repos = createRepos(db);
  const now = new Date().toISOString();
  repos.runs.createRun({
    run_id: "run_test_2", task_id: "task_2", actor_id: "actor_2", actor_mode: "creator",
    status: "planned", graph_id: "graph_2", plan_mode: "safe",
    selected_skill_ids: [], current_node_ids: [], completed_node_ids: [], failed_node_ids: [], artifact_ids: [],
    created_at: now, updated_at: now,
  });
  repos.nodes.createNodes([{
    node_id: "node_1", run_id: "run_test_2", skill_id: "bootstrap", title: "Test node",
    status: "ready", dependency_ids: [], input_refs: [], output_refs: ["out_1"],
    validator_hooks: [], retry_count: 0, max_retries: 2, risk_class: "low",
  }]);
  const nodes = repos.nodes.getNodesByRunId("run_test_2");
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].node_id, "node_1");
  repos.nodes.updateNode("node_1", { status: "completed" });
  const updated = repos.nodes.getNodeById("node_1");
  assert.equal(updated.status, "completed");
});

test("artifact create/get", () => {
  const db = initSqliteFsgrDb();
  const repos = createRepos(db);
  const now = new Date().toISOString();
  repos.runs.createRun({
    run_id: "run_test_3", task_id: "task_3", actor_id: "actor_3", actor_mode: "public",
    status: "planned", graph_id: "graph_3", plan_mode: "fast",
    selected_skill_ids: [], current_node_ids: [], completed_node_ids: [], failed_node_ids: [], artifact_ids: [],
    created_at: now, updated_at: now,
  });
  repos.artifacts.createArtifact({
    artifact_id: "art_1", run_id: "run_test_3", node_id: "node_1",
    artifact_kind: "json", title: "Test artifact", storage_ref: "ref://1",
    validator_results: [{ validator: "output-exists", status: "passed", summary: "OK" }],
  });
  const artifacts = repos.artifacts.getArtifactsByRunId("run_test_3");
  assert.equal(artifacts.length, 1);
  assert.equal(artifacts[0].artifact_id, "art_1");
});

test("capsule save/get", () => {
  const db = initSqliteFsgrDb();
  const repos = createRepos(db);
  const now = new Date().toISOString();
  repos.runs.createRun({
    run_id: "run_test_4", task_id: "task_4", actor_id: "actor_4", actor_mode: "public",
    status: "planned", graph_id: "graph_4", plan_mode: "fast",
    selected_skill_ids: [], current_node_ids: [], completed_node_ids: [], failed_node_ids: [], artifact_ids: [],
    created_at: now, updated_at: now,
  });
  repos.capsules.saveCapsule({
    capsule_id: "cap_1", run_id: "run_test_4",
    capsule_json: JSON.stringify({ goal: "test", active_plan_mode: "fast" }),
  });
  const capsule = repos.capsules.getCapsuleByRunId("run_test_4");
  assert.ok(capsule);
  assert.equal(capsule.capsule_id, "cap_1");
});

test("event append/get", () => {
  const db = initSqliteFsgrDb();
  const repos = createRepos(db);
  const now = new Date().toISOString();
  repos.runs.createRun({
    run_id: "run_test_5", task_id: "task_5", actor_id: "actor_5", actor_mode: "public",
    status: "planned", graph_id: "graph_5", plan_mode: "fast",
    selected_skill_ids: [], current_node_ids: [], completed_node_ids: [], failed_node_ids: [], artifact_ids: [],
    created_at: now, updated_at: now,
  });
  repos.events.appendEvent({ event_id: "evt_1", run_id: "run_test_5", event_type: "run.created", payload_json: "{}" });
  repos.events.appendEvent({ event_id: "evt_2", run_id: "run_test_5", node_id: "node_1", event_type: "node.started", payload_json: "{}" });
  const events = repos.events.getEventsByRunId("run_test_5");
  assert.equal(events.length, 2);
  const nodeEvents = repos.events.getEventsByRunIdAndType("run_test_5", "node.started");
  assert.equal(nodeEvents.length, 1);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
