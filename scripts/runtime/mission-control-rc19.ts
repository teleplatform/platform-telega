import {
  arbitrateInstitutionalGovernance,
  archiveStrategicContinuity,
  createInstitutionalMissionControlDashboard,
  createRuntimeInstitutionalGovernanceFreeze,
  generateGovernancePrecedent,
  lookupGovernancePrecedents,
  recordCivilizationDoctrineEvolution,
  recordInstitutionalMemory,
  registerInstitutionalTrust,
  runInstitutionalSmokePack,
} from "../../src/runtime/mission-control/institutional-governance.js";

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

if (args.memory) {
  result = await recordInstitutionalMemory({
    kind: String(args.kind || "civilization_milestone") as any,
    title: String(args.memory),
    summary: String(args.summary || args.memory),
    trigger: args.trigger ? String(args.trigger) : undefined,
  });
} else if (args.precedent) {
  result = await generateGovernancePrecedent({
    decision: String(args.precedent),
    outcome: String(args.outcome || "review_required"),
    future_reasoning: args.reasoning ? String(args.reasoning) : undefined,
  });
} else if (args.lookup) {
  result = lookupGovernancePrecedents(String(args.lookup));
} else if (args.doctrine) {
  result = await recordCivilizationDoctrineEvolution({
    doctrine: String(args.doctrine),
    why_changed: String(args.why || "RC19 cli doctrine evolution"),
    triggered_by: String(args.trigger || "manual"),
    stabilized_by: String(args.stabilized || "precedent").split(","),
  });
} else if (args.trust) {
  result = await registerInstitutionalTrust({
    subject_type: String(args.subjectType || "governance_action") as any,
    subject_id: String(args.trust),
    trust_score: Number(args.score || 0.8),
    reason: String(args.reason || "RC19 cli trust registration"),
  });
} else if (args.archive) {
  result = await archiveStrategicContinuity({
    epoch: String(args.archive),
    freeze_ref: args.freezeRef ? String(args.freezeRef) : undefined,
    incident_ref: args.incident ? String(args.incident) : undefined,
    stability_transition: args.transition ? String(args.transition) : undefined,
  });
} else if (args.arbitrate) {
  result = await arbitrateInstitutionalGovernance({
    trace_id: String(args.trace || "rc19_cli_trace"),
    current_decision: String(args.arbitrate),
    proposed_action: String(args.action || "bypass verification closure"),
    precedent_query: String(args.query || "unverified closure"),
  });
} else if (args.dashboard) {
  result = await createInstitutionalMissionControlDashboard();
} else if (args.smoke) {
  result = await runInstitutionalSmokePack();
} else if (args.freeze) {
  result = await createRuntimeInstitutionalGovernanceFreeze();
} else {
  result = {
    usage: [
      "npm run mission:control:rc19 -- --memory 'RC19 milestone'",
      "npm run mission:control:rc19 -- --precedent 'unverified closure' --outcome block_and_escalate_for_review",
      "npm run mission:control:rc19 -- --lookup 'unverified closure'",
      "npm run mission:control:rc19 -- --arbitrate 'close before verification'",
      "npm run mission:control:rc19 -- --dashboard",
      "npm run mission:control:rc19 -- --smoke",
      "npm run mission:control:rc19 -- --freeze",
    ],
  };
}

console.log(JSON.stringify({ ok: true, result }, null, 2));
