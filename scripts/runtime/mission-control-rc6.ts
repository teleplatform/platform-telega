import {
  acquireCrossNodeReplayLock,
  buildFederationStabilitySurface,
  coordinateDistributedLoad,
  coordinateDistributedRecovery,
  createFederationOperationsFreeze,
  isolateRuntimeNode,
  recordRuntimeNodeHeartbeat,
  rejoinRuntimeNode,
  releaseCrossNodeReplayLock,
  syncFederationOperationalState,
} from "../../src/runtime/mission-control/federation-operations.js";

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

if (args.heartbeat) {
  result = await recordRuntimeNodeHeartbeat({ node_id: String(args.heartbeat), load: Number(args.load || 0), health: String(args.health || "healthy") as any });
} else if (args.sync) {
  result = await syncFederationOperationalState(String(args.sync));
} else if (args.lock) {
  result = await acquireCrossNodeReplayLock({ trace_id: String(args.lock), node_id: String(args.node || "local") });
} else if (args.release) {
  result = await releaseCrossNodeReplayLock(String(args.release), String(args.node || "local"));
} else if (args.load) {
  result = await coordinateDistributedLoad({ node_id: String(args.node || "local"), priority: String(args.priority || "normal") as any, load: Number(args.load) });
} else if (args.surface) {
  result = await buildFederationStabilitySurface();
} else if (args.isolate) {
  result = await isolateRuntimeNode(String(args.isolate), "mission_control_cli");
} else if (args.rejoin) {
  result = await rejoinRuntimeNode(String(args.rejoin), "mission_control_cli");
} else if (args.recovery) {
  result = await coordinateDistributedRecovery(String(args.recovery));
} else if (args.freeze) {
  result = await createFederationOperationsFreeze();
} else {
  result = {
    usage: [
      "npm run mission:control:rc6 -- --heartbeat node-a --load 0.2",
      "npm run mission:control:rc6 -- --sync local",
      "npm run mission:control:rc6 -- --lock <trace_id> --node node-a",
      "npm run mission:control:rc6 -- --release <trace_id> --node node-a",
      "npm run mission:control:rc6 -- --load 0.9 --node node-a --priority high",
      "npm run mission:control:rc6 -- --surface",
      "npm run mission:control:rc6 -- --isolate node-a",
      "npm run mission:control:rc6 -- --rejoin node-a",
      "npm run mission:control:rc6 -- --recovery local",
      "npm run mission:control:rc6 -- --freeze",
    ],
  };
}

console.log(JSON.stringify({ ok: true, result }, null, 2));
