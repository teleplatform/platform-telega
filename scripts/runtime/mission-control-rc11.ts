import {
  applyHumanOverride,
  checkSafeAutonomousZone,
  createAutonomousActionProposal,
  createAutonomousGovernanceDashboard,
  createRuntimeAutonomousGovernanceFreeze,
  executeAutonomousProposal,
  getExecutionTrustLevel,
  rollbackAutonomousProposal,
  runAutonomousGovernanceSmokePack,
  setExecutionTrustLevel,
  type AutonomousActionProposal,
  type ExecutionTrustLevel,
  type SafeAutonomousZone,
} from "../../src/runtime/mission-control/autonomous-governance.js";

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

if (args.proposal) {
  result = await createAutonomousActionProposal({
    zone: String(args.zone || "digest_generation") as SafeAutonomousZone,
    action: String(args.proposal),
    risk: String(args.risk || "low") as AutonomousActionProposal["risk"],
    expected_effect: String(args.effect || "Execute low-risk autonomous operational action"),
    rollback: String(args.rollback || "record closure").split(",").map((item) => item.trim()).filter(Boolean),
    trace_id: args.trace ? String(args.trace) : undefined,
  });
} else if (args.trust) {
  result = await setExecutionTrustLevel(String(args.trust) as ExecutionTrustLevel, String(args.reason || "rc11 cli"));
} else if (args["get-trust"]) {
  result = { trust_level: getExecutionTrustLevel() };
} else if (args["zone-check"]) {
  result = await checkSafeAutonomousZone(String(args["zone-check"]) as SafeAutonomousZone, String(args.risk || "low") as AutonomousActionProposal["risk"]);
} else if (args.execute) {
  result = await executeAutonomousProposal(String(args.execute));
} else if (args.rollback) {
  result = await rollbackAutonomousProposal(String(args.rollback), String(args.reason || "rc11 cli rollback"));
} else if (args.override) {
  result = await applyHumanOverride({
    pause_autonomy: args.pause === true ? true : args.resume === true ? false : undefined,
    force_approval_mode: args["force-approval"] === true ? true : args["clear-force-approval"] === true ? false : undefined,
    downgrade_trust: args["downgrade-trust"] ? String(args["downgrade-trust"]) as ExecutionTrustLevel : undefined,
    freeze_zone: args["freeze-zone"] ? String(args["freeze-zone"]) as SafeAutonomousZone : undefined,
    clear_frozen_zones: args["clear-frozen-zones"] === true,
    actor: String(args.actor || "operator"),
    reason: args.reason ? String(args.reason) : undefined,
  });
} else if (args.dashboard) {
  result = await createAutonomousGovernanceDashboard();
} else if (args.smoke) {
  result = await runAutonomousGovernanceSmokePack();
} else if (args.freeze) {
  result = await createRuntimeAutonomousGovernanceFreeze();
} else {
  result = {
    usage: [
      "npm run mission:control:rc11 -- --proposal generate_runtime_digest --zone digest_generation --risk low",
      "npm run mission:control:rc11 -- --trust semi_autonomous",
      "npm run mission:control:rc11 -- --get-trust",
      "npm run mission:control:rc11 -- --zone-check cleanup --risk low",
      "npm run mission:control:rc11 -- --execute auto_prop_id",
      "npm run mission:control:rc11 -- --rollback auto_prop_id",
      "npm run mission:control:rc11 -- --override --pause --downgrade-trust approval_required",
      "npm run mission:control:rc11 -- --dashboard",
      "npm run mission:control:rc11 -- --smoke",
      "npm run mission:control:rc11 -- --freeze",
    ],
  };
}

console.log(JSON.stringify({ ok: true, result }, null, 2));
