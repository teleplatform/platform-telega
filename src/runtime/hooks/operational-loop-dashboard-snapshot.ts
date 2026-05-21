import { appendEvidenceRecord, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getAllBudgets, initializeBudgets } from "../economy/runtime-budget-engine.js";
import { getOpenIncidents } from "../incidents/runtime-incident-command.js";
import { getRuntimeHealthLoopStatus } from "./runtime-health-loop-hook.js";
import { listRuntimeDecisionPoints } from "./runtime-decision-point-registry.js";

export interface OperationalLoopDashboardSnapshot {
  snapshot_id: string;
  created_at: string;
  recent_chat_preflights: number;
  decision_points: number;
  budget_consumption: Array<{ category: string; used: number; limit: number }>;
  planning_activations: number;
  incidents_open: number;
  live_feed_events: number;
  closures: number;
  health_loop: ReturnType<typeof getRuntimeHealthLoopStatus>;
  mode_blocks: number;
}

export async function createOperationalLoopDashboardSnapshot(): Promise<OperationalLoopDashboardSnapshot> {
  const snapshotId = `op_loop_${Date.now()}`;
  const records = readEvidenceRecords({ limit: 500 });
  if (getAllBudgets().length === 0) initializeBudgets();
  const snapshot: OperationalLoopDashboardSnapshot = {
    snapshot_id: snapshotId,
    created_at: new Date().toISOString(),
    recent_chat_preflights: records.filter((r) => r.type === "chat_route_preflight_started").length,
    decision_points: listRuntimeDecisionPoints().length || records.filter((r) => r.type === "runtime_decision_point_registered").length,
    budget_consumption: getAllBudgets().map((b) => ({ category: b.category, used: b.used, limit: b.limit })),
    planning_activations: records.filter((r) => r.type === "real_planning_activated").length,
    incidents_open: getOpenIncidents().length,
    live_feed_events: records.filter((r) => r.type === "mission_control_live_event_emitted").length,
    closures: records.filter((r) => r.type === "runtime_closure_completed").length,
    health_loop: getRuntimeHealthLoopStatus(),
    mode_blocks: records.filter((r) => r.type === "runtime_mode_blocked").length,
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(snapshotId, "operational_loop_snapshot_created"),
    trace_id: snapshotId,
    job_id: "dashboard",
    type: "operational_loop_snapshot_created",
    timestamp: snapshot.created_at,
    payload: { ...snapshot },
  });
  await appendEvidenceRecord({
    evidence_id: hashTraceId(snapshotId, "operational_loop_dashboard_viewed"),
    trace_id: snapshotId,
    job_id: "dashboard",
    type: "operational_loop_dashboard_viewed",
    timestamp: new Date().toISOString(),
    payload: { snapshot_id: snapshotId },
  });

  return snapshot;
}
