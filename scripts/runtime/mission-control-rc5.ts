import {
  acquireNextOperationalPriorityJob,
  buildRuntimeCoordinationGraph,
  calculateRuntimeStabilityScore,
  checkRuntimeLoadShedding,
  createRuntimeCoordinationFreeze,
  enqueueOperationalPriorityJob,
  generateOperationalMetrics,
  getRuntimeMaintenanceState,
  runAutonomousCleanup,
  runAutonomousRetry,
  runRuntimeSchedulerCycle,
  setRuntimeMaintenanceState,
} from "../../src/runtime/mission-control/coordination-runtime.js";

function parseArgs(): Record<string, boolean | string> {
  const args: Record<string, boolean | string> = {};
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = process.argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

const args = parseArgs();
let result: unknown;

if (args.scheduler) {
  result = await runRuntimeSchedulerCycle();
} else if (args.retry) {
  result = await runAutonomousRetry({ trace_id: String(args.retry), failure_kind: "transient", attempt: Number(args.attempt || 0) });
} else if (args.maintenance) {
  result = await setRuntimeMaintenanceState(String(args.maintenance) as any, "mission_control_cli");
} else if (args["maintenance-status"]) {
  result = getRuntimeMaintenanceState();
} else if (args.enqueue) {
  result = await enqueueOperationalPriorityJob({ priority: String(args.priority || "normal") as any, kind: String(args.enqueue), trace_id: String(args.trace || "") || undefined });
} else if (args.acquire) {
  result = await acquireNextOperationalPriorityJob();
} else if (args["load-shedding"]) {
  result = await checkRuntimeLoadShedding({ priority: String(args.priority || "normal") as any });
} else if (args.cleanup) {
  result = await runAutonomousCleanup();
} else if (args.graph) {
  result = await buildRuntimeCoordinationGraph(args.graph === true ? undefined : String(args.graph));
} else if (args.metrics) {
  result = await generateOperationalMetrics();
} else if (args.stability) {
  result = await calculateRuntimeStabilityScore();
} else if (args.freeze) {
  result = await createRuntimeCoordinationFreeze();
} else {
  result = {
    usage: [
      "npm run mission:control:rc5 -- --scheduler",
      "npm run mission:control:rc5 -- --retry <trace_id> --attempt 0",
      "npm run mission:control:rc5 -- --maintenance maintenance",
      "npm run mission:control:rc5 -- --enqueue digest --priority high",
      "npm run mission:control:rc5 -- --acquire",
      "npm run mission:control:rc5 -- --load-shedding --priority background",
      "npm run mission:control:rc5 -- --cleanup",
      "npm run mission:control:rc5 -- --graph <trace_id>",
      "npm run mission:control:rc5 -- --metrics",
      "npm run mission:control:rc5 -- --stability",
      "npm run mission:control:rc5 -- --freeze",
    ],
  };
}

console.log(JSON.stringify({ ok: true, result }, null, 2));
