import type { FsgrRuntime } from "../runtime/initRuntime.js";
import { buildContextCapsule } from "../capsule/capsuleBuilder.js";

export function resumeFsgrRun(runtime: FsgrRuntime, runId: string): { status: string; error?: string } {
  const ledger = runtime.ledgerStore.getRun(runId);
  if (!ledger) return { status: "error", error: `Run ${runId} not found` };
  if (ledger.status !== "paused" && ledger.status !== "degraded") {
    return { status: "error", error: `Run ${runId} is not paused or degraded (status: ${ledger.status})` };
  }

  runtime.ledgerStore.updateRun(runId, { status: "running" });
  runtime.ledgerStore.appendEvent({ run_id: runId, event_type: "run.resumed", payload: { from: ledger.status } });

  const nodes = runtime.ledgerStore.getNodes(runId);
  const events = runtime.ledgerStore.getEvents(runId);
  const capsule = buildContextCapsule(runId, { ...ledger, status: "running" }, nodes, events);
  runtime.ledgerStore.saveCapsule({ capsule_id: capsule.capsule_id, run_id: runId, capsule_json: JSON.stringify(capsule) });
  runtime.ledgerStore.appendEvent({ run_id: runId, event_type: "capsule.updated", payload: { capsule_id: capsule.capsule_id } });

  return { status: "running" };
}
