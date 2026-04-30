import assert from "node:assert/strict";
import { initFsgrRuntime } from "../../packages/fsgr-runtime/src/runtime/initRuntime.js";
import { startFsgrRun } from "../../packages/fsgr-runtime/src/api/startRun.js";
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
  console.log("\nIntegration: FSGR Planning Basic:");

  await test("start run selects skills and builds DAG", async () => {
    const runtime = initFsgrRuntime();
    const result = await startFsgrRun(runtime, {
      task_id: "plan_basic_1", actor_id: "actor_1", actor_mode: "creator",
      intent_key: "build", task_kind: "landing_build", goal: "Build landing page with content",
      constraints: [], execution_mode: "quality",
    });
    assert.ok(result.ledger.run_id);
    assert.ok(result.graph.nodes.length > 0);
    assert.ok(result.selection.selected_count > 0);
    assert.ok(result.capsule.capsule_id);

    const events = runtime.ledgerStore.getEvents(result.ledger.run_id);
    assert.ok(events.some((e) => e.event_type === "run.created"));
    assert.ok(events.some((e) => e.event_type === "plan.built"));
  });

  await test("get run returns planned status", async () => {
    const runtime = initFsgrRuntime();
    const result = await startFsgrRun(runtime, {
      task_id: "plan_basic_2", actor_id: "actor_2", actor_mode: "public",
      intent_key: "fix", task_kind: "ui_fix", goal: "Fix UI bug",
      constraints: [], execution_mode: "fast",
    });
    const run = getFsgrRun(runtime, result.ledger.run_id);
    assert.ok(run);
    assert.equal(run!.status, "planned");
  });

  await test("get graph returns valid DAG", async () => {
    const runtime = initFsgrRuntime();
    const result = await startFsgrRun(runtime, {
      task_id: "plan_basic_3", actor_id: "actor_3", actor_mode: "creator",
      intent_key: "build", task_kind: "api_build", goal: "Build API endpoint",
      constraints: [], execution_mode: "safe",
    });
    const graph = getFsgrRunGraph(runtime, result.ledger.run_id);
    assert.ok(graph);
    assert.ok(graph!.nodes.length > 0);
  });

  await test("explain works after planning", async () => {
    const runtime = initFsgrRuntime();
    const result = await startFsgrRun(runtime, {
      task_id: "plan_basic_4", actor_id: "actor_4", actor_mode: "creator",
      intent_key: "research", task_kind: "research_compare", goal: "Compare research findings",
      constraints: [], execution_mode: "quality",
    });
    const explain = getFsgrRunExplain(runtime, result.ledger.run_id) as any;
    assert.equal(explain.ok, true);
    assert.ok(explain.run_summary);
    assert.ok(explain.capsule);
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
