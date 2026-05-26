import {
  arbitrateCivilizationTruth,
  buildOperationalRealityGraph,
  createCivilizationRealityKernelState,
  createRealityCivilizationDashboard,
  createRuntimeRealityCivilizationFreeze,
  detectRealityDrift,
  generateLongHorizonRealityForecast,
  runRealityKernelSmokePack,
  verifySovereignTruthPreservation,
} from "../../src/runtime/mission-control/reality-civilization-kernel.js";

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

if (args.state) {
  result = await createCivilizationRealityKernelState({
    trace_id: String(args.trace || "rc21_cli_trace"),
    claim: String(args.state),
    execution_ref: args.execution ? String(args.execution) : undefined,
    effect_ref: args.effect ? String(args.effect) : undefined,
    verification_ref: args.verification ? String(args.verification) : undefined,
  });
} else if (args.graph) {
  result = await buildOperationalRealityGraph();
} else if (args.drift) {
  result = await detectRealityDrift({
    trace_id: args.trace ? String(args.trace) : undefined,
    claimed_state: String(args.drift),
  });
} else if (args.arbitrate) {
  result = await arbitrateCivilizationTruth({
    trace_id: String(args.trace || "rc21_cli_trace"),
    verification_required: true,
    claims: [
      { actor: "planner", claim: String(args.arbitrate), confidence: "weak" },
      { actor: "verifier", claim: String(args.verified || "verified operational truth"), confidence: "verified" },
    ],
  });
} else if (args.preservation) {
  result = await verifySovereignTruthPreservation();
} else if (args.forecast) {
  result = await generateLongHorizonRealityForecast();
} else if (args.dashboard) {
  result = await createRealityCivilizationDashboard();
} else if (args.smoke) {
  result = await runRealityKernelSmokePack();
} else if (args.freeze) {
  result = await createRuntimeRealityCivilizationFreeze();
} else {
  result = {
    usage: [
      "npm run mission:control:rc21 -- --state 'claimed stable' --trace rc21_cli_trace",
      "npm run mission:control:rc21 -- --graph",
      "npm run mission:control:rc21 -- --drift 'claimed stable'",
      "npm run mission:control:rc21 -- --arbitrate 'conflicting claim' --trace rc21_cli_trace",
      "npm run mission:control:rc21 -- --preservation",
      "npm run mission:control:rc21 -- --forecast",
      "npm run mission:control:rc21 -- --dashboard",
      "npm run mission:control:rc21 -- --smoke",
      "npm run mission:control:rc21 -- --freeze",
    ],
  };
}

console.log(JSON.stringify({ ok: true, result }, null, 2));
