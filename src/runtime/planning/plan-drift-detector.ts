import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getPlan } from "./strategic-planning-engine.js";
import { readEvidenceRecords } from "../evidence/execution-evidence-store.js";

export interface PlanDriftEntry {
  drift_id: string;
  plan_id: string;
  description: string;
  severity: "warning" | "major" | "critical";
  escalated: boolean;
  detected_at: string;
}

let driftCounter = 0;

export function detectPlanDrift(planId: string): PlanDriftEntry[] {
  driftCounter++;
  const drifts: PlanDriftEntry[] = [];
  const plan = getPlan(planId);

  if (!plan) return [];

  const evidence = readEvidenceRecords();
  const planEvidence = evidence.filter((e) => e.payload?.plan_id === planId || e.trace_id === planId);

  const executionStarted = planEvidence.find((e) => e.type === "governed_plan_execution_started");
  const materials = planEvidence.filter((e) => e.type === "plan_pack_materialized");

  if (executionStarted && materials.length === 0) {
    drifts.push({
      drift_id: `plan_drift_${Date.now()}_${driftCounter}`,
      plan_id: planId,
      description: "Execution started but no packs materialized",
      severity: "major",
      escalated: false,
      detected_at: new Date().toISOString(),
    });
  }

  const planPhases = plan.phases.length;
  const expectedMaterials = planPhases;
  if (materials.length < expectedMaterials) {
    drifts.push({
      drift_id: `plan_drift_${Date.now()}_${driftCounter}`,
      plan_id: planId,
      description: `Expected ${expectedMaterials} materialized packs, got ${materials.length}`,
      severity: materials.length === 0 ? "critical" : "warning",
      escalated: false,
      detected_at: new Date().toISOString(),
    });
  }

  for (const d of drifts) {
    const emitType = d.severity === "critical" ? "plan_drift_escalated" : "plan_drift_detected";
    appendEvidenceRecord({
      evidence_id: hashTraceId(d.drift_id, emitType),
      trace_id: d.drift_id,
      job_id: "planning",
      type: emitType,
      timestamp: d.detected_at,
      payload: {
        drift_id: d.drift_id,
        plan_id: planId,
        severity: d.severity,
        description: d.description,
      },
    });
    if (d.severity === "critical") d.escalated = true;
  }

  return drifts;
}
