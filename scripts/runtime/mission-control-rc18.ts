import {
  buildAgentGovernanceHierarchy,
  createMultiAgentMissionControlDashboard,
  createRuntimeMultiAgentSocietyFreeze,
  declareAgentIdentity,
  recordAgentCooperation,
  recordAgentCoordinationMemory,
  resolveAgentDisagreement,
  runMultiAgentSmokePack,
  updateAgentReputation,
} from "../../src/runtime/mission-control/multi-agent-society.js";

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
  result = await declareAgentIdentity({
    identity: String(args.identity),
    role: String(args.role || "execution") as any,
    trust: args.trust ? String(args.trust) as any : undefined,
    specialization: args.specialization ? String(args.specialization).split(",") : undefined,
  });
} else if (args.cooperate) {
  result = await recordAgentCooperation({
    trace_id: String(args.trace || "rc18_cli_trace"),
    from_agent_id: String(args.from || "agent_planner"),
    to_agent_id: String(args.to || "agent_verifier"),
    action: String(args.cooperate) as any,
    task: String(args.task || "rc18 cli cooperation"),
    evidence_ref: args.evidence ? String(args.evidence) : undefined,
  });
} else if (args.disagree) {
  result = await resolveAgentDisagreement({
    trace_id: String(args.trace || "rc18_cli_trace"),
    issue: String(args.disagree),
    agents: [
      { agent_id: String(args.a || "agent_planner"), role: "planner", position: "close_after_claim" },
      { agent_id: String(args.b || "agent_verifier"), role: "verifier", position: "require_verification" },
    ],
  });
} else if (args.reputation) {
  result = await updateAgentReputation(String(args.reputation));
} else if (args.hierarchy) {
  result = await buildAgentGovernanceHierarchy();
} else if (args.memory) {
  result = await recordAgentCoordinationMemory({
    trace_id: String(args.trace || "rc18_cli_trace"),
    kind: String(args.kind || "lesson") as any,
    summary: String(args.memory),
    agent_ids: String(args.agents || "").split(",").filter(Boolean),
  });
} else if (args.dashboard) {
  result = await createMultiAgentMissionControlDashboard();
} else if (args.smoke) {
  result = await runMultiAgentSmokePack();
} else if (args.freeze) {
  result = await createRuntimeMultiAgentSocietyFreeze();
} else {
  result = {
    usage: [
      "npm run mission:control:rc18 -- --identity verifier --role verifier",
      "npm run mission:control:rc18 -- --cooperate delegate --from agent_a --to agent_b --trace rc18_cli_trace",
      "npm run mission:control:rc18 -- --disagree 'planner vs verifier' --trace rc18_cli_trace",
      "npm run mission:control:rc18 -- --hierarchy",
      "npm run mission:control:rc18 -- --dashboard",
      "npm run mission:control:rc18 -- --smoke",
      "npm run mission:control:rc18 -- --freeze",
    ],
  };
}

console.log(JSON.stringify({ ok: true, result }, null, 2));
