import {
  arbitrateCivilizationConstitutionalCourt,
  createConstitutionalEvolutionGovernance,
  createConstitutionalMissionControlDashboard,
  createRuntimeConstitutionalCivilizationFreeze,
  generateCivilizationStabilityCharter,
  generateConstitutionalPrecedenceMatrix,
  runConstitutionalCivilizationSmokePack,
  verifyConstitutionalIntegrity,
  verifyImmutableCivilizationGuarantees,
} from "../../src/runtime/mission-control/constitutional-civilization.js";

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

if (args.precedence) {
  result = await generateConstitutionalPrecedenceMatrix();
} else if (args.court) {
  result = await arbitrateCivilizationConstitutionalCourt({
    trace_id: String(args.trace || "rc20_cli_trace"),
    conflict_kind: String(args.kind || "autonomy_conflicts_constitution") as any,
    petitioner: String(args.petitioner || "operator"),
    action: String(args.court),
    policy_ref: args.policy ? String(args.policy) : undefined,
    doctrine_ref: args.doctrine ? String(args.doctrine) : undefined,
  });
} else if (args.guarantees) {
  result = await verifyImmutableCivilizationGuarantees();
} else if (args.evolution) {
  result = await createConstitutionalEvolutionGovernance({
    proposal: String(args.evolution),
    change_scope: String(args.scope || "doctrine") as any,
    reason: String(args.reason || "RC20 cli constitutional evolution"),
    requested_by: String(args.by || "operator"),
  });
} else if (args.charter) {
  result = await generateCivilizationStabilityCharter();
} else if (args.integrity) {
  result = await verifyConstitutionalIntegrity();
} else if (args.dashboard) {
  result = await createConstitutionalMissionControlDashboard();
} else if (args.smoke) {
  result = await runConstitutionalCivilizationSmokePack();
} else if (args.freeze) {
  result = await createRuntimeConstitutionalCivilizationFreeze();
} else {
  result = {
    usage: [
      "npm run mission:control:rc20 -- --precedence",
      "npm run mission:control:rc20 -- --court 'bypass_sovereignty claim_success_without_evidence'",
      "npm run mission:control:rc20 -- --guarantees",
      "npm run mission:control:rc20 -- --evolution 'Strengthen doctrine' --scope doctrine",
      "npm run mission:control:rc20 -- --charter",
      "npm run mission:control:rc20 -- --integrity",
      "npm run mission:control:rc20 -- --dashboard",
      "npm run mission:control:rc20 -- --smoke",
      "npm run mission:control:rc20 -- --freeze",
    ],
  };
}

console.log(JSON.stringify({ ok: true, result }, null, 2));
