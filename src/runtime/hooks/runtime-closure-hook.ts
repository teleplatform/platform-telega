import { appendEvidenceRecord, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getAllBudgets } from "../economy/runtime-budget-engine.js";
import { getOpenIncidents } from "../incidents/runtime-incident-command.js";
import { emitMissionControlLiveEvent } from "./mission-control-live-feed-hook.js";
import { checkRuntimeDecisionPoint } from "./runtime-decision-point-registry.js";

export type RuntimeClosureStatus = "success" | "failure" | "blocked";

export interface RuntimeClosureInput {
  trace_id: string;
  status: RuntimeClosureStatus;
  route?: string;
  reason?: string;
  actor_id?: string;
}

export interface RuntimeClosureReport {
  closure_id: string;
  trace_id: string;
  status: RuntimeClosureStatus;
  verification_status: "passed" | "failed" | "blocked";
  incident_count: number;
  evidence_count: number;
  budget_summary: Array<{ category: string; used: number; limit: number }>;
  mission_control_summary: string;
  closed_at: string;
}

export async function createRuntimeClosure(input: RuntimeClosureInput): Promise<RuntimeClosureReport> {
  const closureId = `closure_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  await checkRuntimeDecisionPoint({ kind: "closure", trace_id: input.trace_id, actor_id: input.actor_id });

  await appendEvidenceRecord({
    evidence_id: hashTraceId(closureId, "runtime_closure_started"),
    trace_id: input.trace_id,
    job_id: "closure",
    type: "runtime_closure_started",
    timestamp: new Date().toISOString(),
    payload: { closure_id: closureId, status: input.status, route: input.route },
  });

  try {
    const records = readEvidenceRecords({ trace_id: input.trace_id });
    const incidents = getOpenIncidents();
    const budgets = getAllBudgets().map((b) => ({ category: b.category, used: b.used, limit: b.limit }));
    const verification = input.status === "success" ? "passed" : input.status === "blocked" ? "blocked" : "failed";
    const report: RuntimeClosureReport = {
      closure_id: closureId,
      trace_id: input.trace_id,
      status: input.status,
      verification_status: verification,
      incident_count: incidents.length,
      evidence_count: records.length,
      budget_summary: budgets,
      mission_control_summary: `${input.status.toUpperCase()} ${input.route || "runtime"} trace=${input.trace_id} evidence=${records.length} incidents=${incidents.length}`,
      closed_at: new Date().toISOString(),
    };

    await appendEvidenceRecord({
      evidence_id: hashTraceId(closureId, "runtime_closure_completed"),
      trace_id: input.trace_id,
      job_id: "closure",
      type: "runtime_closure_completed",
      timestamp: report.closed_at,
      payload: { ...report, reason: input.reason },
    });

    return report;
  } catch (e: any) {
    await appendEvidenceRecord({
      evidence_id: hashTraceId(closureId, "runtime_closure_failed"),
      trace_id: input.trace_id,
      job_id: "closure",
      type: "runtime_closure_failed",
      timestamp: new Date().toISOString(),
      payload: { closure_id: closureId, error: e?.message || String(e) },
    });
    await emitMissionControlLiveEvent({
      kind: "execution_failed",
      severity: "medium",
      title: "Runtime closure failed",
      trace_id: input.trace_id,
      payload: { closure_id: closureId, error: e?.message || String(e) },
    });
    throw e;
  }
}
