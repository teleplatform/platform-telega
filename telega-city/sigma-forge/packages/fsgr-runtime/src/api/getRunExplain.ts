import type { FsgrRuntime } from "../runtime/initRuntime.js";

export function getFsgrRunExplain(runtime: FsgrRuntime, runId: string) {
  const ledger = runtime.ledgerStore.getRun(runId);
  if (!ledger) return { ok: false, error: `Run ${runId} not found` };

  const nodes = runtime.ledgerStore.getNodes(runId);
  const events = runtime.ledgerStore.getEvents(runId);
  const artifacts = runtime.repos.artifacts.getArtifactsByRunId(runId);
  const capsuleRow = runtime.ledgerStore.getCapsule(runId);
  const capsule = capsuleRow ? JSON.parse(capsuleRow.capsule_json) : null;

  const nodeTransitions = events
    .filter((e) => e.event_type.startsWith("node."))
    .map((e) => ({ node_id: e.node_id, event: e.event_type, at: e.created_at }));

  const retries = events.filter((e) => e.event_type === "node.retry_scheduled").length;
  const fallbacks = events.filter((e) => e.event_type === "node.fallback_used").length;

  return {
    ok: true,
    run_id: runId,
    run_summary: {
      task_id: ledger.task_id,
      status: ledger.status,
      plan_mode: ledger.plan_mode,
      total_nodes: nodes.length,
      completed_nodes: nodes.filter((n: any) => n.status === "completed").length,
      failed_nodes: nodes.filter((n: any) => n.status === "failed").length,
      artifact_count: artifacts.length,
    },
    node_transitions: nodeTransitions,
    retries,
    fallbacks,
    last_error: ledger.last_error,
    capsule: capsule ? {
      capsule_id: capsule.capsule_id,
      goal: capsule.goal,
      active_plan_mode: capsule.active_plan_mode,
      completed_milestones: capsule.completed_milestones,
      open_risks: capsule.open_risks,
      next_actions: capsule.next_actions,
    } : null,
    artifact_summary: artifacts.map((a: any) => ({ artifact_id: a.artifact_id, kind: a.artifact_kind, title: a.title })),
    explain_summary: `Run ${ledger.status}: ${nodes.filter((n: any) => n.status === "completed").length}/${nodes.length} nodes completed, ${retries} retries, ${fallbacks} fallbacks`,
  };
}
