import assert from "node:assert/strict";
import { initFsgrRuntime } from "../../packages/fsgr-runtime/src/runtime/initRuntime.js";
import { startFsgrRun } from "../../packages/fsgr-runtime/src/api/startRun.js";
import { executeFsgrRun } from "../../packages/fsgr-runtime/src/api/executeRun.js";
import { getFsgrRun } from "../../packages/fsgr-runtime/src/api/getRun.js";
import { getFsgrRunGraph } from "../../packages/fsgr-runtime/src/api/getRunGraph.js";
import { getFsgrRunExplain } from "../../packages/fsgr-runtime/src/api/getRunExplain.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.then(() => {
        passed++;
        console.log(`  ✓ ${name}`);
      }).catch((e) => {
        failed++;
        console.error(`  ✗ ${name}\n    ${e.message}`);
      });
    }
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`  ✗ ${name}\n    ${e.message}`);
  }
}

async function runTests() {
  console.log("\nIntegration: FSGR Execution Basic:");

  await test("start run + execute run = completed", async () => {
    const runtime = initFsgrRuntime();
    const startResult = await startFsgrRun(runtime, {
      task_id: "exec_basic_1", actor_id: "actor_1", actor_mode: "creator",
      intent_key: "build", task_kind: "ui_fix", goal: "Fix UI bug",
      constraints: [], execution_mode: "fast",
    });
    assert.ok(startResult.ledger.run_id);
    assert.equal(startResult.ledger.status, "planned");
    assert.ok(startResult.graph.nodes.length > 0);

    const execResult = await executeFsgrRun(runtime, startResult.ledger.run_id);
    assert.equal(execResult.status, "completed");
    assert.equal(execResult.completed, startResult.graph.nodes.length);
    assert.equal(execResult.failed, 0);
  });

  await test("nodes completed after execution", async () => {
    const runtime = initFsgrRuntime();
    const startResult = await startFsgrRun(runtime, {
      task_id: "exec_basic_2", actor_id: "actor_2", actor_mode: "creator",
      intent_key: "fix", task_kind: "ui_fix", goal: "Fix UI",
      constraints: [], execution_mode: "fast",
    });
    await executeFsgrRun(runtime, startResult.ledger.run_id);

    const run = getFsgrRun(runtime, startResult.ledger.run_id);
    assert.ok(run);
    assert.equal(run!.status, "completed");
    assert.equal(run!.completed_node_ids.length, startResult.graph.nodes.length);
  });

  await test("artifacts persisted after execution", async () => {
    const runtime = initFsgrRuntime();
    const startResult = await startFsgrRun(runtime, {
      task_id: "exec_basic_3", actor_id: "actor_3", actor_mode: "creator",
      intent_key: "build", task_kind: "ui_fix", goal: "Fix UI",
      constraints: [], execution_mode: "fast",
    });
    await executeFsgrRun(runtime, startResult.ledger.run_id);

    const artifacts = runtime.repos.artifacts.getArtifactsByRunId(startResult.ledger.run_id);
    assert.ok(artifacts.length > 0);
  });

  await test("explain reflects execution", async () => {
    const runtime = initFsgrRuntime();
    const startResult = await startFsgrRun(runtime, {
      task_id: "exec_basic_4", actor_id: "actor_4", actor_mode: "creator",
      intent_key: "build", task_kind: "ui_fix", goal: "Fix UI",
      constraints: [], execution_mode: "fast",
    });
    await executeFsgrRun(runtime, startResult.ledger.run_id);

    const explain = getFsgrRunExplain(runtime, startResult.ledger.run_id) as any;
    assert.equal(explain.ok, true);
    assert.equal(explain.run_summary.status, "completed");
    assert.ok(explain.run_summary.completed_nodes > 0);
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
