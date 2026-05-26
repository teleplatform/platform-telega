import {
  buildOperatorAuditTimeline,
  createGovernanceDashboard,
  createGovernanceDriftAlerts,
  createRuntimeGovernanceOperationsFreeze,
  evaluateRuntimeConfidence,
  recordGovernanceDecision,
  runGovernanceSmokePack,
} from "../../src/runtime/mission-control/governance-operations.js";

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

if (args.decision) {
  result = await recordGovernanceDecision({
    trace_id: String(args.trace || `gov_cli_${Date.now()}`),
    decision: String(args.decision),
    why: String(args.why || "mission_control_cli"),
    risk_level: String(args.risk || "medium") as any,
  });
} else if (args.confidence) {
  result = await evaluateRuntimeConfidence({
    trace_id: String(args.confidence),
    contradiction_count: Number(args.contradictions || 0),
    policy_blocks: Number(args.policy_blocks || 0),
    risk_level: String(args.risk || "medium") as any,
  });
} else if (args.drift) {
  result = await createGovernanceDriftAlerts();
} else if (args.timeline) {
  result = await buildOperatorAuditTimeline(args.timeline === true ? undefined : String(args.timeline));
} else if (args.dashboard) {
  result = await createGovernanceDashboard();
} else if (args.smoke) {
  result = await runGovernanceSmokePack();
} else if (args.freeze) {
  result = await createRuntimeGovernanceOperationsFreeze();
} else {
  result = {
    usage: [
      "npm run mission:control:rc9 -- --decision 'approve_runtime_action' --trace trace_id --why 'policy matched'",
      "npm run mission:control:rc9 -- --confidence trace_id --risk high",
      "npm run mission:control:rc9 -- --drift",
      "npm run mission:control:rc9 -- --timeline <trace_id>",
      "npm run mission:control:rc9 -- --dashboard",
      "npm run mission:control:rc9 -- --smoke",
      "npm run mission:control:rc9 -- --freeze",
    ],
  };
}

console.log(JSON.stringify({ ok: true, result }, null, 2));
