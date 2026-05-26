import {
  coordinateConsciousStability,
  createCivilizationCoordinationConsciousness,
  createCivilizationSituationalAwareness,
  createConsciousCoordinationDashboard,
  createRuntimeConsciousCoordinationFreeze,
  routeCivilizationAttention,
  runConsciousCoordinationSmokePack,
  synchronizeCrossLayerAwareness,
  verifySovereignAwarenessGuarantees,
} from "../../src/runtime/mission-control/conscious-coordination.js";

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

if (args.awareness) {
  result = await createCivilizationCoordinationConsciousness({ trace_id: String(args.trace || "rc26_cli_trace") });
} else if (args.sync) {
  result = await synchronizeCrossLayerAwareness({ trace_id: args.trace ? String(args.trace) : undefined });
} else if (args.attention) {
  result = await routeCivilizationAttention({
    trace_id: args.trace ? String(args.trace) : undefined,
    critical_risks: Number(args.critical || 0),
    emerging_instability: Number(args.instability || 1),
    operator_overload: Number(args.operator || 0),
    federation_anomalies: Number(args.federation || 0),
  });
} else if (args.stability) {
  result = await coordinateConsciousStability({ trace_id: args.trace ? String(args.trace) : undefined });
} else if (args.situation) {
  result = await createCivilizationSituationalAwareness({ trace_id: args.trace ? String(args.trace) : undefined });
} else if (args.guarantees) {
  result = await verifySovereignAwarenessGuarantees({ trace_id: args.trace ? String(args.trace) : undefined });
} else if (args.dashboard) {
  result = await createConsciousCoordinationDashboard();
} else if (args.smoke) {
  result = await runConsciousCoordinationSmokePack();
} else if (args.freeze) {
  result = await createRuntimeConsciousCoordinationFreeze();
} else {
  result = {
    usage: [
      "npm run mission:control:rc26 -- --awareness",
      "npm run mission:control:rc26 -- --sync",
      "npm run mission:control:rc26 -- --attention --critical 1 --instability 1",
      "npm run mission:control:rc26 -- --stability",
      "npm run mission:control:rc26 -- --situation",
      "npm run mission:control:rc26 -- --guarantees",
      "npm run mission:control:rc26 -- --dashboard",
      "npm run mission:control:rc26 -- --smoke",
      "npm run mission:control:rc26 -- --freeze",
    ],
  };
}

console.log(JSON.stringify({ ok: true, result }, null, 2));
