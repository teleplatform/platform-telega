import { initFsgrRuntime } from "./packages/fsgr-runtime/src/runtime/initRuntime.js";
import { startFsgrRun } from "./packages/fsgr-runtime/src/api/startRun.js";

async function main() {
  const runtime = initFsgrRuntime();
  const result = await startFsgrRun(runtime, {
    task_id: "test_1", actor_id: "actor_1", actor_mode: "creator",
    intent_key: "build", task_kind: "ui_fix", goal: "Fix UI bug",
    constraints: [], execution_mode: "fast",
  });
  console.log("ledger:", result.ledger.run_id);
  console.log("graph:", result.graph ? "exists" : "undefined");
  console.log("graph.nodes:", result.graph ? result.graph.nodes.length : "N/A");
  console.log("selection:", result.selection);
}

main().catch(e => console.error(e));
