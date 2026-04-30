import type { ContextCapsule } from "../../../fsgr-contracts/src/index.js";
import type { RunLedger } from "../../../fsgr-contracts/src/index.js";
import type { LedgerEvent } from "../ledger/ledgerEvents.js";
import { randomUUID } from "crypto";

export function buildContextCapsule(
  runId: string,
  ledger: RunLedger,
  nodes: any[],
  events: LedgerEvent[]
): ContextCapsule {
  const recentEvents = events.slice(-20);
  const completedMilestones = ledger.completed_node_ids.map((id) => {
    const node = nodes.find((n) => n.node_id === id);
    return node?.title ?? id;
  });

  const openRisks: string[] = [];
  if (ledger.failed_node_ids.length > 0) openRisks.push(`${ledger.failed_node_ids.length} node(s) failed`);
  if (ledger.status === "degraded") openRisks.push("Run in degraded mode");

  const lastDecisions = recentEvents
    .filter((e) => e.event_type.includes("retry") || e.event_type.includes("fallback"))
    .slice(-5)
    .map((e) => ({ kind: e.event_type, summary: JSON.stringify(e.payload).substring(0, 100), at: e.created_at }));

  const nextActions = nodes
    .filter((n) => n.status === "ready" || n.status === "waiting_dependency")
    .slice(0, 3)
    .map((n) => n.title);

  return {
    capsule_id: `capsule_${randomUUID()}`,
    run_id: runId,
    goal: ledger.task_id,
    active_plan_mode: ledger.plan_mode,
    current_focus: nodes.filter((n) => n.status === "running").map((n) => n.title),
    completed_milestones: completedMilestones,
    open_risks: openRisks,
    last_decisions: lastDecisions,
    evidence_summary: [`Run ${ledger.status}: ${ledger.completed_node_ids.length}/${nodes.length} nodes completed`],
    next_actions: nextActions,
    updated_at: new Date().toISOString(),
  };
}
