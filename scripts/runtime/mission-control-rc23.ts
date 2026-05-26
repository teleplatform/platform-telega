import {
  arbitrateCognitiveCost,
  createCivilizationEconomicBrain,
  createEconomicCivilizationDashboard,
  createRuntimeEconomicCivilizationFreeze,
  detectCivilizationScarcity,
  enforceEconomicSovereignty,
  generateLongHorizonEconomicStability,
  generateStrategicResourceForecast,
  runEconomicCivilizationSmokePack,
} from "../../src/runtime/mission-control/economic-civilization.js";

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

if (args.brain) {
  result = await createCivilizationEconomicBrain({
    trace_id: String(args.trace || "rc23_cli_trace"),
  });
} else if (args.forecast) {
  result = await generateStrategicResourceForecast({
    trace_id: args.trace ? String(args.trace) : undefined,
  });
} else if (args.arbitrate) {
  result = await arbitrateCognitiveCost({
    trace_id: String(args.trace || "rc23_cli_trace"),
    priority: String(args.arbitrate || "recovery") as any,
    required_budget: Number(args.required || 120),
    capacity: Number(args.capacity || 180),
    risk: String(args.risk || "medium") as any,
  });
} else if (args.scarcity) {
  result = await detectCivilizationScarcity({
    trace_id: String(args.trace || "rc23_cli_trace"),
    signals: {
      compute: Number(args.compute || 0.9),
      attention: Number(args.attention || 0.85),
      recovery_cost: Number(args.recovery || 0.86),
      federation_load: Number(args.federation || 0.84),
      autonomy_pressure: Number(args.autonomy || 0.8),
    },
  });
} else if (args.sovereignty) {
  result = await enforceEconomicSovereignty({
    trace_id: args.trace ? String(args.trace) : undefined,
  });
} else if (args.stability) {
  result = await generateLongHorizonEconomicStability({
    trace_id: args.trace ? String(args.trace) : undefined,
  });
} else if (args.dashboard) {
  result = await createEconomicCivilizationDashboard();
} else if (args.smoke) {
  result = await runEconomicCivilizationSmokePack();
} else if (args.freeze) {
  result = await createRuntimeEconomicCivilizationFreeze();
} else {
  result = {
    usage: [
      "npm run mission:control:rc23 -- --brain --trace rc23_cli_trace",
      "npm run mission:control:rc23 -- --forecast",
      "npm run mission:control:rc23 -- --arbitrate recovery --required 120 --capacity 180 --risk medium",
      "npm run mission:control:rc23 -- --scarcity --compute 0.94 --attention 0.88",
      "npm run mission:control:rc23 -- --sovereignty",
      "npm run mission:control:rc23 -- --stability",
      "npm run mission:control:rc23 -- --dashboard",
      "npm run mission:control:rc23 -- --smoke",
      "npm run mission:control:rc23 -- --freeze",
    ],
  };
}

console.log(JSON.stringify({ ok: true, result }, null, 2));
