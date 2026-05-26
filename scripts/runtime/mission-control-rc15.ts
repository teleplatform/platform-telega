import {
  arbitrateStrategicResources,
  balanceCivilizationRisk,
  coordinateCivilizationContinuity,
  createCivilizationOrchestrationDashboard,
  createMultiEpochRuntimePlan,
  createRuntimeCivilizationOrchestrationFreeze,
  generateCivilizationObjectives,
  runCivilizationOrchestrationSmokePack,
  selectRuntimeCivilizationPolicy,
} from "../../src/runtime/mission-control/civilization-orchestration.js";

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

if (args.objectives) {
  result = await generateCivilizationObjectives();
} else if (args.plan) {
  result = await createMultiEpochRuntimePlan();
} else if (args.risk) {
  result = await balanceCivilizationRisk();
} else if (args.resources) {
  result = await arbitrateStrategicResources();
} else if (args.policy) {
  result = await selectRuntimeCivilizationPolicy();
} else if (args.continuity) {
  result = await coordinateCivilizationContinuity();
} else if (args.dashboard) {
  result = await createCivilizationOrchestrationDashboard();
} else if (args.smoke) {
  result = await runCivilizationOrchestrationSmokePack();
} else if (args.freeze) {
  result = await createRuntimeCivilizationOrchestrationFreeze();
} else {
  result = {
    usage: [
      "npm run mission:control:rc15 -- --objectives",
      "npm run mission:control:rc15 -- --plan",
      "npm run mission:control:rc15 -- --risk",
      "npm run mission:control:rc15 -- --resources",
      "npm run mission:control:rc15 -- --policy",
      "npm run mission:control:rc15 -- --continuity",
      "npm run mission:control:rc15 -- --dashboard",
      "npm run mission:control:rc15 -- --smoke",
      "npm run mission:control:rc15 -- --freeze",
    ],
  };
}

console.log(JSON.stringify({ ok: true, result }, null, 2));
