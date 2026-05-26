import {
  createMissionControlExportPack,
  createRuntimeProductExperienceFreeze,
  createUnifiedMissionControlUiContract,
  deliverRuntimeDigest,
  openRuntimeExplainabilityViewer,
  runProductExperienceSmokePack,
  searchOperationalSurface,
  setRuntimeOperatorMode,
  startOperatorSession,
  updateNotificationPreferences,
} from "../../src/runtime/mission-control/product-experience.js";

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

if (args.contract) {
  result = await createUnifiedMissionControlUiContract();
} else if (args.session) {
  result = await startOperatorSession({ operator_id: String(args.session), mode: String(args.mode || "operator") as any });
} else if (args.mode && args.session_id) {
  result = await setRuntimeOperatorMode(String(args.session_id), String(args.mode) as any);
} else if (args.prefs) {
  result = await updateNotificationPreferences({ operator_id: String(args.prefs), critical_only: args["critical-only"] === true });
} else if (args.digest) {
  result = await deliverRuntimeDigest({ channel: String(args.digest) as any, target: String(args.target || "") || undefined });
} else if (args.explain) {
  result = await openRuntimeExplainabilityViewer(String(args.explain));
} else if (args.search) {
  result = await searchOperationalSurface({ trace_id: String(args.search), approval_id: String(args.approval || "") || undefined });
} else if (args.export) {
  result = await createMissionControlExportPack({ trace_id: args.export === true ? undefined : String(args.export) });
} else if (args.smoke) {
  result = await runProductExperienceSmokePack();
} else if (args.freeze) {
  result = await createRuntimeProductExperienceFreeze();
} else {
  result = {
    usage: [
      "npm run mission:control:rc10 -- --contract",
      "npm run mission:control:rc10 -- --session operator-id --mode operator",
      "npm run mission:control:rc10 -- --prefs operator-id --critical-only",
      "npm run mission:control:rc10 -- --digest telegram",
      "npm run mission:control:rc10 -- --explain trace_id",
      "npm run mission:control:rc10 -- --search trace_id",
      "npm run mission:control:rc10 -- --export trace_id",
      "npm run mission:control:rc10 -- --smoke",
      "npm run mission:control:rc10 -- --freeze",
    ],
  };
}

console.log(JSON.stringify({ ok: true, result }, null, 2));
