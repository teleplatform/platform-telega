import {
  createRuntimeSovereignIntelligenceFreeze,
  createSovereignMissionControlSurface,
  declareSovereignRuntimeIdentity,
  enforceSovereignBoundary,
  executeSovereignEscalation,
  generateCivilizationContinuityDoctrine,
  generateStrategicSovereignReasoning,
  runSovereignIntegrityAudit,
  runSovereignSmokePack,
} from "../../src/runtime/mission-control/sovereign-intelligence.js";

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
  result = await declareSovereignRuntimeIdentity();
} else if (args.boundary) {
  result = await enforceSovereignBoundary({
    action: String(args.boundary),
    actor: String(args.actor || "operator"),
    requested_autonomy_level: args.autonomy ? String(args.autonomy) : undefined,
  });
} else if (args.reasoning) {
  result = await generateStrategicSovereignReasoning();
} else if (args.doctrine) {
  result = await generateCivilizationContinuityDoctrine();
} else if (args.escalate) {
  result = await executeSovereignEscalation({
    existential_risk: true,
    reason: args.reason ? String(args.reason) : "rc16 cli escalation",
  });
} else if (args.audit) {
  result = await runSovereignIntegrityAudit();
} else if (args.surface) {
  result = await createSovereignMissionControlSurface();
} else if (args.smoke) {
  result = await runSovereignSmokePack();
} else if (args.freeze) {
  result = await createRuntimeSovereignIntelligenceFreeze();
} else {
  result = {
    usage: [
      "npm run mission:control:rc16 -- --identity",
      "npm run mission:control:rc16 -- --boundary bypass_sovereignty --autonomy trusted_autonomous",
      "npm run mission:control:rc16 -- --reasoning",
      "npm run mission:control:rc16 -- --doctrine",
      "npm run mission:control:rc16 -- --escalate",
      "npm run mission:control:rc16 -- --audit",
      "npm run mission:control:rc16 -- --surface",
      "npm run mission:control:rc16 -- --smoke",
      "npm run mission:control:rc16 -- --freeze",
    ],
  };
}

console.log(JSON.stringify({ ok: true, result }, null, 2));
