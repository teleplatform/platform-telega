import { createMissionControlDashboardSnapshot } from "../../src/runtime/mission-control/mission-control-dashboard.js";
import { validateTelegramMissionControlConfig } from "../../src/runtime/mission-control/telegram-sender.js";

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

if (args.validate) {
  const result = await validateTelegramMissionControlConfig({ send_test: args["send-test"] === true });
  if (json) {
    console.log(JSON.stringify({ ok: result.ok, telegram: result }, null, 2));
  } else {
    console.log("MISSION CONTROL TELEGRAM CONFIG");
    console.log(`  ok:            ${result.ok}`);
    console.log(`  enabled:       ${result.enabled}`);
    console.log(`  dry_run:       ${result.dry_run}`);
    console.log(`  has_bot_token: ${result.has_bot_token}`);
    console.log(`  has_chat_id:   ${result.has_chat_id}`);
    console.log(`  send_test:     ${result.send_test?.ok ?? "-"}`);
    if (result.errors.length) console.log(`  errors:        ${result.errors.join(", ")}`);
  }
  process.exit(result.ok ? 0 : 1);
}

const snapshot = await createMissionControlDashboardSnapshot({ validate_send_test: args["send-test"] === true });
if (json) {
  console.log(JSON.stringify({ ok: true, snapshot }, null, 2));
} else {
  console.log("MISSION CONTROL SNAPSHOT");
  console.log(`  snapshot_id:    ${snapshot.snapshot_id}`);
  console.log(`  created_at:     ${snapshot.created_at}`);
  console.log(`  live_events:    ${snapshot.live_feed.length}`);
  console.log(`  incidents_open: ${snapshot.incidents.length}`);
  console.log(`  approvals:      replay=${snapshot.approvals.replay.length} execution=${snapshot.approvals.execution.length} incident=${snapshot.approvals.incident.length}`);
  console.log(`  telegram:       enabled=${snapshot.telegram.enabled} dry_run=${snapshot.telegram.dry_run} ok=${snapshot.telegram.ok}`);
  console.log(`  burn_rate:      ${snapshot.burn_rate.burn_rate_per_minute.toFixed(2)}/min`);
}
