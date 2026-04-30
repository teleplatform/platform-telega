import type { RunLedger } from "../../fsgr-contracts/src/runLedger.js";
import type { ExecutionGraph } from "../../fsgr-contracts/src/executionGraph.js";
import type { LedgerEvent } from "./ledgerEvents.js";

export function buildRunSummary(ledger: RunLedger, graph: ExecutionGraph) {
  return {
    run_id: ledger.run_id,
    task_id: ledger.task_id,
    status: ledger.status,
    plan_mode: ledger.plan_mode,
    total_nodes: graph.nodes.length,
    completed_nodes: ledger.completed_node_ids.length,
    failed_nodes: ledger.failed_node_ids.length,
    artifact_count: ledger.artifact_ids.length,
    selected_skills: ledger.selected_skill_ids,
    created_at: ledger.created_at,
    updated_at: ledger.updated_at,
  };
}

export function buildRunExplainSummary(ledger: RunLedger, events: LedgerEvent[]) {
  const nodeTransitions = events
    .filter((e) => e.event_type.startsWith("node."))
    .map((e) => ({ node_id: e.node_id, event: e.event_type, at: e.created_at }));

  const retries = events.filter((e) => e.event_type === "node.retry_scheduled");
  const fallbacks = events.filter((e) => e.event_type === "node.fallback_used");

  return {
    run_id: ledger.run_id,
    status: ledger.status,
    node_transitions: nodeTransitions,
    retry_count: retries.length,
    fallback_count: fallbacks.length,
    last_error: ledger.last_error,
  };
}
