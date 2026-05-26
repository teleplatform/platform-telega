import {
  createCivilizationStrategicIdentity,
  createLongHorizonCivilizationIntent,
  createRuntimeStrategicConsciousnessFreeze,
  createSovereignStrategicReflection,
  createStrategicConsciousnessDashboard,
  detectStrategicConsciousnessDrift,
  recordCivilizationStrategicMemory,
  runStrategicConsciousnessSmokePack,
  verifyCivilizationIntegrityAnchors,
} from "../../src/runtime/mission-control/strategic-consciousness.js";

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

if (args.identity) {
  result = await createCivilizationStrategicIdentity({ trace_id: String(args.trace || "rc27_cli_trace") });
} else if (args.intent) {
  result = await createLongHorizonCivilizationIntent({ trace_id: args.trace ? String(args.trace) : undefined });
} else if (args.memory) {
  result = await recordCivilizationStrategicMemory({
    trace_id: args.trace ? String(args.trace) : undefined,
    epoch: args.epoch ? String(args.epoch) : undefined,
    transition: args.transition ? String(args.transition) : undefined,
    doctrine_shift: args.doctrine ? String(args.doctrine) : undefined,
    governance_era: args.governance ? String(args.governance) : undefined,
    milestone: args.milestone ? String(args.milestone) : undefined,
  });
} else if (args.drift) {
  result = await detectStrategicConsciousnessDrift({
    trace_id: args.trace ? String(args.trace) : undefined,
    loss_of_purpose: args.loss === "1" || args.loss === "true",
    goal_fragmentation: args.fragmentation === "1" || args.fragmentation === "true",
    governance_incoherence: args.incoherence === "1" || args.incoherence === "true",
    stability_obsession: args.stability === "1" || args.stability === "true",
    adaptation_obsession: args.adaptation === "1" || args.adaptation === "true",
  });
} else if (args.reflection) {
  result = await createSovereignStrategicReflection({ trace_id: args.trace ? String(args.trace) : undefined });
} else if (args.anchors) {
  result = await verifyCivilizationIntegrityAnchors({ trace_id: args.trace ? String(args.trace) : undefined });
} else if (args.dashboard) {
  result = await createStrategicConsciousnessDashboard();
} else if (args.smoke) {
  result = await runStrategicConsciousnessSmokePack();
} else if (args.freeze) {
  result = await createRuntimeStrategicConsciousnessFreeze();
} else {
  result = {
    usage: [
      "npm run mission:control:rc27 -- --identity",
      "npm run mission:control:rc27 -- --intent",
      "npm run mission:control:rc27 -- --memory --epoch current",
      "npm run mission:control:rc27 -- --drift --loss 1 --fragmentation 1",
      "npm run mission:control:rc27 -- --reflection",
      "npm run mission:control:rc27 -- --anchors",
      "npm run mission:control:rc27 -- --dashboard",
      "npm run mission:control:rc27 -- --smoke",
      "npm run mission:control:rc27 -- --freeze",
    ],
  };
}

console.log(JSON.stringify({ ok: true, result }, null, 2));
