import {
  analyzeCivilizationMutationRisk,
  createAdaptiveCivilizationEvolution,
  createEvolutionCivilizationDashboard,
  createRuntimeAdaptiveEvolutionFreeze,
  createSovereignEvolutionGovernance,
  generateLongHorizonEvolutionForecast,
  runAdaptiveEvolutionSmokePack,
  verifyControlledEvolutionZone,
  verifyEvolutionContinuityGuarantees,
} from "../../src/runtime/mission-control/adaptive-evolution.js";

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

if (args.evolution) {
  result = await createAdaptiveCivilizationEvolution({
    trace_id: String(args.trace || "rc24_cli_trace"),
    weakness: String(args.weakness || "execution weakness"),
    adaptation: String(args.evolution),
    rollback_plan: String(args.rollback || "rollback to previous policy"),
    verification_plan: String(args.verification || "verify observable effect"),
  });
} else if (args.zone) {
  result = await verifyControlledEvolutionZone({
    trace_id: String(args.trace || "rc24_cli_trace"),
    evolution_ref: String(args.zone),
    approved: true,
    bounded: true,
    rollbackable: true,
    verifiable: true,
  });
} else if (args.risk) {
  result = await analyzeCivilizationMutationRisk({
    trace_id: String(args.trace || "rc24_cli_trace"),
    adaptation: String(args.risk),
    economic_pressure: String(args.economic || "medium") as any,
    governance_confidence: String(args.confidence || "high") as any,
  });
} else if (args.forecast) {
  result = await generateLongHorizonEvolutionForecast({
    trace_id: args.trace ? String(args.trace) : undefined,
  });
} else if (args.guarantees) {
  result = await verifyEvolutionContinuityGuarantees({
    trace_id: args.trace ? String(args.trace) : undefined,
  });
} else if (args.governance) {
  result = await createSovereignEvolutionGovernance({
    trace_id: String(args.trace || "rc24_cli_trace"),
    evolution_ref: String(args.governance),
    proposal_ref: String(args.proposal || "proposal_ref"),
    simulation_ref: String(args.simulation || "simulation_ref"),
    risk_ref: String(args.risk_ref || "risk_ref"),
  });
} else if (args.dashboard) {
  result = await createEvolutionCivilizationDashboard();
} else if (args.smoke) {
  result = await runAdaptiveEvolutionSmokePack();
} else if (args.freeze) {
  result = await createRuntimeAdaptiveEvolutionFreeze();
} else {
  result = {
    usage: [
      "npm run mission:control:rc24 -- --evolution 'reduce concurrency' --weakness 'execution congestion'",
      "npm run mission:control:rc24 -- --zone adaptive_evolution_ref",
      "npm run mission:control:rc24 -- --risk 'reduce background execution concurrency'",
      "npm run mission:control:rc24 -- --forecast",
      "npm run mission:control:rc24 -- --guarantees",
      "npm run mission:control:rc24 -- --governance adaptive_evolution_ref",
      "npm run mission:control:rc24 -- --dashboard",
      "npm run mission:control:rc24 -- --smoke",
      "npm run mission:control:rc24 -- --freeze",
    ],
  };
}

console.log(JSON.stringify({ ok: true, result }, null, 2));
