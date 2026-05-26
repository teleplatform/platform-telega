import {
  analyzeGovernanceTradeoff,
  createLongHorizonGovernancePlan,
  createRuntimeStrategicGovernanceFreeze,
  createStrategicGovernanceDashboard,
  generateGovernanceStabilityHeuristics,
  generateRuntimeConstitutionalIntelligence,
  projectStrategicDrift,
  runStrategicGovernanceEngine,
  runStrategicGovernanceSmokePack,
  type GovernanceTradeoffKind,
} from "../../src/runtime/mission-control/strategic-governance.js";

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

if (args.analysis) {
  result = await runStrategicGovernanceEngine();
} else if (args.tradeoff) {
  result = await analyzeGovernanceTradeoff(String(args.tradeoff) as GovernanceTradeoffKind);
} else if (args.plan) {
  result = await createLongHorizonGovernancePlan();
} else if (args.drift) {
  result = await projectStrategicDrift();
} else if (args.heuristics) {
  result = await generateGovernanceStabilityHeuristics();
} else if (args.constitutional) {
  result = await generateRuntimeConstitutionalIntelligence();
} else if (args.dashboard) {
  result = await createStrategicGovernanceDashboard();
} else if (args.smoke) {
  result = await runStrategicGovernanceSmokePack();
} else if (args.freeze) {
  result = await createRuntimeStrategicGovernanceFreeze();
} else {
  result = {
    usage: [
      "npm run mission:control:rc14 -- --analysis",
      "npm run mission:control:rc14 -- --tradeoff security_vs_availability",
      "npm run mission:control:rc14 -- --plan",
      "npm run mission:control:rc14 -- --drift",
      "npm run mission:control:rc14 -- --heuristics",
      "npm run mission:control:rc14 -- --constitutional",
      "npm run mission:control:rc14 -- --dashboard",
      "npm run mission:control:rc14 -- --smoke",
      "npm run mission:control:rc14 -- --freeze",
    ],
  };
}

console.log(JSON.stringify({ ok: true, result }, null, 2));
