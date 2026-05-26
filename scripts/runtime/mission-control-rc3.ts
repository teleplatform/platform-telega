import {
  buildOperationalReplayConsole,
  createOperationalRuntimeFreeze,
  generateOperationalDigest,
  renderTelegramCommandSurface,
  updateRuntimeOperatorPresence,
} from "../../src/runtime/mission-control/operational-runtime.js";

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
if (args.presence) {
  result = await updateRuntimeOperatorPresence({
    state: String(args.presence) as any,
    actor: "mission_control_cli",
  });
} else if (args.digest) {
  result = await generateOperationalDigest(Number(args.window || 60));
} else if (args.replay) {
  result = await buildOperationalReplayConsole(String(args.replay));
} else if (args.command) {
  result = await renderTelegramCommandSurface(String(args.command));
} else if (args.freeze) {
  result = await createOperationalRuntimeFreeze();
} else {
  result = {
    usage: [
      "npm run mission:control:rc3 -- --presence online",
      "npm run mission:control:rc3 -- --digest",
      "npm run mission:control:rc3 -- --replay <trace_id>",
      "npm run mission:control:rc3 -- --command /status",
      "npm run mission:control:rc3 -- --freeze",
    ],
  };
}

if (json) {
  console.log(JSON.stringify({ ok: true, result }, null, 2));
} else if (typeof result === "string") {
  console.log(result);
} else {
  console.log(JSON.stringify(result, null, 2));
}
