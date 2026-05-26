import {
  createCivilizationMetaCognition,
  createMetaCognitionDashboard,
  createRuntimeMetaCognitionFreeze,
  detectCognitiveBlindspots,
  generateMetaStabilityForecast,
  planCivilizationSelfCorrection,
  reflectGovernanceBehavior,
  runMetaCognitionSmokePack,
  verifySovereignMetaGovernance,
} from "../../src/runtime/mission-control/meta-cognition.js";

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

if (args.meta) {
  result = await createCivilizationMetaCognition({ trace_id: String(args.trace || "rc25_cli_trace") });
} else if (args.reflect) {
  result = await reflectGovernanceBehavior({ trace_id: args.trace ? String(args.trace) : undefined });
} else if (args.blindspots) {
  result = await detectCognitiveBlindspots({ trace_id: args.trace ? String(args.trace) : undefined });
} else if (args.correct) {
  result = await planCivilizationSelfCorrection({
    trace_id: String(args.trace || "rc25_cli_trace"),
    weakness: String(args.weakness || "governance weakness"),
    correction: String(args.correct),
  });
} else if (args.forecast) {
  result = await generateMetaStabilityForecast({ trace_id: args.trace ? String(args.trace) : undefined });
} else if (args.guarantees) {
  result = await verifySovereignMetaGovernance({ trace_id: args.trace ? String(args.trace) : undefined });
} else if (args.dashboard) {
  result = await createMetaCognitionDashboard();
} else if (args.smoke) {
  result = await runMetaCognitionSmokePack();
} else if (args.freeze) {
  result = await createRuntimeMetaCognitionFreeze();
} else {
  result = {
    usage: [
      "npm run mission:control:rc25 -- --meta",
      "npm run mission:control:rc25 -- --reflect",
      "npm run mission:control:rc25 -- --blindspots",
      "npm run mission:control:rc25 -- --correct 'increase evidence completeness checks'",
      "npm run mission:control:rc25 -- --forecast",
      "npm run mission:control:rc25 -- --guarantees",
      "npm run mission:control:rc25 -- --dashboard",
      "npm run mission:control:rc25 -- --smoke",
      "npm run mission:control:rc25 -- --freeze",
    ],
  };
}

console.log(JSON.stringify({ ok: true, result }, null, 2));
