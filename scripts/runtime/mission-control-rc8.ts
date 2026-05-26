import {
  createRuntimeSecurityOperationsFreeze,
  createSecurityMissionControlDashboard,
  detectSecurityEvents,
  executeSecretExposureResponse,
  executeSecurityPlaybook,
  monitorFederationThreats,
  runRuntimeAccessAudit,
  runSecuritySmokePack,
} from "../../src/runtime/mission-control/security-operations.js";

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

if (args.detect) {
  result = await detectSecurityEvents({ text: String(args.detect), command: String(args.command || ""), trace_id: String(args.trace || "") || undefined });
} else if (args.secret) {
  result = await executeSecretExposureResponse({ text: String(args.secret), trace_id: String(args.trace || "") || undefined });
} else if (args.audit) {
  result = await runRuntimeAccessAudit({
    subject: { id: String(args.subject || "viewer"), roles: [String(args.role || "viewer") as any] },
    action: String(args.audit) as any,
  });
} else if (args.threats) {
  result = await monitorFederationThreats();
} else if (args.playbook) {
  result = await executeSecurityPlaybook(String(args.playbook) as any, String(args.trace || "") || undefined);
} else if (args.dashboard) {
  result = await createSecurityMissionControlDashboard();
} else if (args.smoke) {
  result = await runSecuritySmokePack();
} else if (args.freeze) {
  result = await createRuntimeSecurityOperationsFreeze();
} else {
  result = {
    usage: [
      "npm run mission:control:rc8 -- --detect 'text' --command 'rm -rf /'",
      "npm run mission:control:rc8 -- --secret 'OPENAI_API_KEY=sk-...'",
      "npm run mission:control:rc8 -- --audit system:config --subject alice --role viewer",
      "npm run mission:control:rc8 -- --threats",
      "npm run mission:control:rc8 -- --playbook secret_leak",
      "npm run mission:control:rc8 -- --dashboard",
      "npm run mission:control:rc8 -- --smoke",
      "npm run mission:control:rc8 -- --freeze",
    ],
  };
}

console.log(JSON.stringify({ ok: true, result }, null, 2));
