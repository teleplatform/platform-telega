import { initFsgrRuntime } from "./packages/fsgr-runtime/src/runtime/initRuntime.js";
import { startFsgrRun } from "./packages/fsgr-runtime/src/api/startRun.js";
import { executeFsgrRun } from "./packages/fsgr-runtime/src/api/executeRun.js";

async function main() {
  const runtime = initFsgrRuntime();
  const startResult = await startFsgrRun(runtime, {
    task_id: "test_1", actor_id: "actor_1", actor_mode: "creator",
    intent_key: "build", task_kind: "ui_fix", goal: "Fix UI bug",
    constraints: [], execution_mode: "fast",
  });
  console.log("start OK:", startResult.ledger.run_id);
  console.log("graph.nodes:", startResult.graph.nodes.length);
  
  try {
    const execResult = await executeFsgrRun(runtime, startResult.ledger.run_id);
    console.log("exec OK:", execResult);
  } catch (e: any) {
    console.error("exec ERROR:", e.message);
    console.error(e.stack);
  }
}

main().catch(e => console.error(e));
