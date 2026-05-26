import {
  applyRuntimeSelfStabilization,
  arbitrateCognitivePriority,
  buildCrossLayerCognitiveGraph,
  createCognitiveMissionControlDashboard,
  createRuntimeCognitiveCoordinationFreeze,
  resolveCognitiveConflict,
  runCognitiveCoordinationSmokePack,
  selectRuntimeIntent,
  updateRuntimeStrategicObjectives,
  type CognitiveSignal,
} from "../../src/runtime/mission-control/cognitive-coordination.js";

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

const conflictSignals: CognitiveSignal[] = [
  { layer: "economy", intent: "defer", priority: "economy", reason: "budget wants defer", risk: "medium", evidence_refs: ["economy_budget_pressure"] },
  { layer: "security", intent: "freeze", priority: "security", reason: "security wants freeze", risk: "critical", evidence_refs: ["security_risk"] },
  { layer: "recovery", intent: "recover", priority: "recovery", reason: "recovery wants execute", risk: "high", evidence_refs: ["recovery_path"] },
];

const args = parseArgs();
let result: unknown;

if (args.graph) {
  result = await buildCrossLayerCognitiveGraph(args.trace ? String(args.trace) : undefined);
} else if (args.intent) {
  result = await selectRuntimeIntent();
} else if (args.conflict) {
  result = await resolveCognitiveConflict({
    conflict_id: args.conflict === true ? undefined : String(args.conflict),
    trace_id: args.trace ? String(args.trace) : "rc12_cli_conflict",
    signals: conflictSignals,
  });
} else if (args.objectives) {
  result = await updateRuntimeStrategicObjectives();
} else if (args.arbitrate) {
  result = await arbitrateCognitivePriority(conflictSignals);
} else if (args.stabilize) {
  result = await applyRuntimeSelfStabilization(args.reason ? String(args.reason) : "rc12 cli");
} else if (args.dashboard) {
  result = await createCognitiveMissionControlDashboard();
} else if (args.smoke) {
  result = await runCognitiveCoordinationSmokePack();
} else if (args.freeze) {
  result = await createRuntimeCognitiveCoordinationFreeze();
} else {
  result = {
    usage: [
      "npm run mission:control:rc12 -- --graph",
      "npm run mission:control:rc12 -- --intent",
      "npm run mission:control:rc12 -- --conflict",
      "npm run mission:control:rc12 -- --objectives",
      "npm run mission:control:rc12 -- --arbitrate",
      "npm run mission:control:rc12 -- --stabilize",
      "npm run mission:control:rc12 -- --dashboard",
      "npm run mission:control:rc12 -- --smoke",
      "npm run mission:control:rc12 -- --freeze",
    ],
  };
}

console.log(JSON.stringify({ ok: true, result }, null, 2));
