import {
  createRealityMissionControlDashboard,
  createRuntimeRealityVerificationFreeze,
  detectFalseSuccess,
  enforceSovereignTruth,
  evaluateRuntimeTruthConfidence,
  recordExecutionTruthLedger,
  runRealityVerificationEngine,
  runRealityVerificationSmokePack,
  trackObservableEffect,
} from "../../src/runtime/mission-control/reality-verification.js";

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

if (args.truth) {
  result = await recordExecutionTruthLedger({
    trace_id: String(args.trace || "rc17_cli_trace"),
    stage: String(args.truth) as any,
    intent: String(args.intent || "rc17 cli truth ledger"),
    claimed_success: args.claimed === true,
    notes: args.notes ? String(args.notes) : undefined,
  });
} else if (args.verify) {
  result = await runRealityVerificationEngine(String(args.verify));
} else if (args.effect) {
  result = await trackObservableEffect({
    trace_id: String(args.trace || "rc17_cli_trace"),
    expected_effect: String(args.expected || "runtime effect"),
    observed_effect: String(args.effect),
    changed_reality: args.changed !== "false",
    evidence_ref: args.evidence ? String(args.evidence) : undefined,
  });
} else if (args.falseSuccess) {
  result = await detectFalseSuccess(args.trace ? String(args.trace) : undefined);
} else if (args.confidence) {
  result = await evaluateRuntimeTruthConfidence(String(args.confidence));
} else if (args.enforce) {
  result = await enforceSovereignTruth({
    trace_id: String(args.trace || "rc17_cli_trace"),
    action: String(args.enforce) as any,
  });
} else if (args.dashboard) {
  result = await createRealityMissionControlDashboard();
} else if (args.smoke) {
  result = await runRealityVerificationSmokePack();
} else if (args.freeze) {
  result = await createRuntimeRealityVerificationFreeze();
} else {
  result = {
    usage: [
      "npm run mission:control:rc17 -- --truth planned --trace rc17_cli_trace",
      "npm run mission:control:rc17 -- --effect changed --trace rc17_cli_trace",
      "npm run mission:control:rc17 -- --verify rc17_cli_trace",
      "npm run mission:control:rc17 -- --falseSuccess --trace rc17_cli_trace",
      "npm run mission:control:rc17 -- --confidence rc17_cli_trace",
      "npm run mission:control:rc17 -- --enforce claim_success --trace rc17_cli_trace",
      "npm run mission:control:rc17 -- --dashboard",
      "npm run mission:control:rc17 -- --smoke",
      "npm run mission:control:rc17 -- --freeze",
    ],
  };
}

console.log(JSON.stringify({ ok: true, result }, null, 2));
