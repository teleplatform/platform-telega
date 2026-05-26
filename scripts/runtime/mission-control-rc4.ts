import {
  createRuntimeRecoveryDashboard,
  createRuntimeRecoveryFreeze,
  createRuntimeStateSnapshot,
  recoverMissionControlBoot,
  reconstructOperationalTimeline,
  resumeInterruptedReplay,
  runRecoveryIntegrityAudit,
  simulateFullRuntimeRestart,
} from "../../src/runtime/mission-control/recovery-operations.js";

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
const json = args.json === true;

let result: unknown;
if (args.boot) {
  result = await recoverMissionControlBoot();
} else if (args.snapshot) {
  result = await createRuntimeStateSnapshot();
} else if (args.resume) {
  result = await resumeInterruptedReplay(String(args.resume));
} else if (args.timeline) {
  result = await reconstructOperationalTimeline(args.timeline === true ? undefined : String(args.timeline));
} else if (args.audit) {
  result = await runRecoveryIntegrityAudit();
} else if (args.dashboard) {
  result = await createRuntimeRecoveryDashboard();
} else if (args["simulate-restart"]) {
  result = await simulateFullRuntimeRestart(String(args["simulate-restart"]));
} else if (args.freeze) {
  result = await createRuntimeRecoveryFreeze();
} else {
  result = {
    usage: [
      "npm run mission:control:rc4 -- --boot",
      "npm run mission:control:rc4 -- --snapshot",
      "npm run mission:control:rc4 -- --resume <trace_id>",
      "npm run mission:control:rc4 -- --timeline <trace_id>",
      "npm run mission:control:rc4 -- --audit",
      "npm run mission:control:rc4 -- --dashboard",
      "npm run mission:control:rc4 -- --simulate-restart <trace_id>",
      "npm run mission:control:rc4 -- --freeze",
    ],
  };
}

if (json) {
  console.log(JSON.stringify({ ok: true, result }, null, 2));
} else {
  console.log(JSON.stringify(result, null, 2));
}
