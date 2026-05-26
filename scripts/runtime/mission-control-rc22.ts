import {
  createCivilizationFabricDashboard,
  createRuntimeCivilizationExecutionFabricFreeze,
  createUnifiedCivilizationExecutionFabric,
  recoverExecutionFabric,
  recordCrossLayerExecutionLineage,
  runExecutionFabricSmokePack,
  synchronizeCivilizationExecution,
  verifyDistributedExecutionIntegrity,
  verifySovereignExecutionGuarantees,
} from "../../src/runtime/mission-control/civilization-execution-fabric.js";

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

if (args.fabric) {
  result = await createUnifiedCivilizationExecutionFabric({
    trace_id: String(args.trace || "rc22_cli_trace"),
  });
} else if (args.lineage) {
  result = await recordCrossLayerExecutionLineage({
    trace_id: String(args.trace || "rc22_cli_trace"),
    intent: String(args.lineage),
    plan_ref: args.plan ? String(args.plan) : undefined,
    approval_ref: args.approval ? String(args.approval) : undefined,
    execution_ref: args.execution ? String(args.execution) : undefined,
    observable_effect_ref: args.effect ? String(args.effect) : undefined,
    verification_ref: args.verification ? String(args.verification) : undefined,
    closure_ref: args.closure ? String(args.closure) : undefined,
    memory_ref: args.memory ? String(args.memory) : undefined,
  });
} else if (args.sync) {
  result = await synchronizeCivilizationExecution({
    trace_id: String(args.trace || "rc22_cli_trace"),
    nodes: ["local-runtime", "peer-runtime"],
    agents: ["operator", "verifier"],
  });
} else if (args.integrity) {
  result = await verifyDistributedExecutionIntegrity({
    trace_id: args.trace ? String(args.trace) : undefined,
  });
} else if (args.recovery) {
  result = await recoverExecutionFabric({
    trace_id: String(args.trace || "rc22_cli_trace"),
    fracture: String(args.recovery),
  });
} else if (args.guarantees) {
  result = await verifySovereignExecutionGuarantees({
    trace_id: args.trace ? String(args.trace) : undefined,
  });
} else if (args.dashboard) {
  result = await createCivilizationFabricDashboard();
} else if (args.smoke) {
  result = await runExecutionFabricSmokePack();
} else if (args.freeze) {
  result = await createRuntimeCivilizationExecutionFabricFreeze();
} else {
  result = {
    usage: [
      "npm run mission:control:rc22 -- --fabric --trace rc22_cli_trace",
      "npm run mission:control:rc22 -- --lineage 'intent' --trace rc22_cli_trace",
      "npm run mission:control:rc22 -- --sync --trace rc22_cli_trace",
      "npm run mission:control:rc22 -- --integrity",
      "npm run mission:control:rc22 -- --recovery 'fabric fracture' --trace rc22_cli_trace",
      "npm run mission:control:rc22 -- --guarantees",
      "npm run mission:control:rc22 -- --dashboard",
      "npm run mission:control:rc22 -- --smoke",
      "npm run mission:control:rc22 -- --freeze",
    ],
  };
}

console.log(JSON.stringify({ ok: true, result }, null, 2));
