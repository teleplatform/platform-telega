import {
  createCivilizationContinuityKernel,
  createContinuityMissionControlDashboard,
  createRuntimeCivilizationContinuityFreeze,
  detectCivilizationFragmentation,
  preserveLongHorizonCivilization,
  recoverStrategicContinuity,
  runContinuityKernelSmokePack,
  runEpochTransitionEngine,
  verifySovereignContinuityGuarantees,
} from "../../src/runtime/mission-control/civilization-continuity-kernel.js";

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

if (args.kernel) {
  result = await createCivilizationContinuityKernel({ trace_id: String(args.trace || "rc28_cli_trace") });
} else if (args.transition) {
  result = await runEpochTransitionEngine({
    trace_id: args.trace ? String(args.trace) : undefined,
    from_epoch: args.from ? String(args.from) : undefined,
    to_epoch: args.to ? String(args.to) : undefined,
    transition_reason: args.reason ? String(args.reason) : undefined,
  });
} else if (args.fragmentation) {
  result = await detectCivilizationFragmentation({
    trace_id: args.trace ? String(args.trace) : undefined,
    identity_split: args.identity === "1" || args.identity === "true",
    governance_fragmentation: args.governance === "1" || args.governance === "true",
    federation_divergence: args.federation === "1" || args.federation === "true",
    continuity_erosion: args.erosion === "1" || args.erosion === "true",
  });
} else if (args.recovery) {
  result = await recoverStrategicContinuity({ trace_id: args.trace ? String(args.trace) : undefined });
} else if (args.guarantees) {
  result = await verifySovereignContinuityGuarantees({ trace_id: args.trace ? String(args.trace) : undefined });
} else if (args.preserve) {
  result = await preserveLongHorizonCivilization({ trace_id: args.trace ? String(args.trace) : undefined });
} else if (args.dashboard) {
  result = await createContinuityMissionControlDashboard();
} else if (args.smoke) {
  result = await runContinuityKernelSmokePack();
} else if (args.freeze) {
  result = await createRuntimeCivilizationContinuityFreeze();
} else {
  result = {
    usage: [
      "npm run mission:control:rc28 -- --kernel",
      "npm run mission:control:rc28 -- --transition --from strategic_consciousness --to continuity_kernel",
      "npm run mission:control:rc28 -- --fragmentation --identity 1 --governance 1 --federation 1 --erosion 1",
      "npm run mission:control:rc28 -- --recovery",
      "npm run mission:control:rc28 -- --guarantees",
      "npm run mission:control:rc28 -- --preserve",
      "npm run mission:control:rc28 -- --dashboard",
      "npm run mission:control:rc28 -- --smoke",
      "npm run mission:control:rc28 -- --freeze",
    ],
  };
}

console.log(JSON.stringify({ ok: true, result }, null, 2));
