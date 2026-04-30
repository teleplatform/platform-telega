import type { RunLedger } from "../../fsgr-contracts/src/runLedger.js";
import type { ExecutionGraph } from "../../fsgr-contracts/src/executionGraph.js";
import type { ContextCapsule } from "../../fsgr-contracts/src/capsule.js";
import type { LedgerEvent } from "../ledger/ledgerEvents.js";
import { buildRunSummary, buildRunExplainSummary } from "../ledger/ledgerSnapshot.js";
import { getRunEvents } from "../ledger/ledgerStore.js";
import { getTraceEvents } from "./traceHooks.js";

export function buildRunExplain(
  runId: string,
  ledger: RunLedger,
  graph: ExecutionGraph,
  capsule: ContextCapsule
) {
  const events = getRunEvents(runId);
  const traceEvents = getTraceEvents(runId);
  const summary = buildRunSummary(ledger, graph);
  const explainSummary = buildRunExplainSummary(ledger, events);

  return {
    run_id: runId,
    run_summary: summary,
    node_transitions: explainSummary.node_transitions,
    retries: explainSummary.retry_count,
    fallbacks: explainSummary.fallback_count,
    last_error: ledger.last_error,
    capsule: {
      capsule_id: capsule.capsule_id,
      goal: capsule.goal,
      active_plan_mode: capsule.active_plan_mode,
      completed_milestones: capsule.completed_milestones,
      open_risks: capsule.open_risks,
      next_actions: capsule.next_actions,
    },
    trace_event_count: traceEvents.length,
    total_events: events.length,
  };
}
