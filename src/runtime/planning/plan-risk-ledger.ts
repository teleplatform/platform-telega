import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { getPlan } from "./strategic-planning-engine.js";

export interface RiskEntry {
  risk_id: string;
  plan_id: string;
  category: "blocker" | "drift" | "failed_pack" | "policy_friction" | "resource_pressure";
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  detected_at: string;
}

const RISKS: Map<string, RiskEntry> = new Map();
let riskCounter = 0;

export async function updateRiskLedger(planId: string): Promise<RiskEntry[]> {
  riskCounter++;
  const plan = getPlan(planId);
  if (!plan) return [];

  const evidence = readEvidenceRecords();
  const planEvidence = evidence.filter((e) => e.payload?.plan_id === planId || e.trace_id === planId);
  const newRisks: RiskEntry[] = [];

  const blockers = planEvidence.filter((e) => e.type === "plan_progress_blocked");
  for (const b of blockers) {
    const risk: RiskEntry = {
      risk_id: `risk_${Date.now()}_${riskCounter}`,
      plan_id: planId,
      category: "blocker",
      description: `Blocked step: ${b.evidence_id}`,
      severity: "high",
      detected_at: new Date().toISOString(),
    };
    RISKS.set(risk.risk_id, risk);
    newRisks.push(risk);
  }

  const drifts = planEvidence.filter((e) => e.type === "plan_drift_detected" || e.type === "plan_drift_escalated");
  for (const d of drifts) {
    const risk: RiskEntry = {
      risk_id: `risk_${Date.now()}_${riskCounter}`,
      plan_id: planId,
      category: "drift",
      description: `Drift: ${d.payload?.description as string || d.evidence_id}`,
      severity: d.type === "plan_drift_escalated" ? "critical" : "medium",
      detected_at: new Date().toISOString(),
    };
    RISKS.set(risk.risk_id, risk);
    newRisks.push(risk);
  }

  const policyFrictions = planEvidence.filter((e) => e.type === "governed_plan_execution_blocked" || e.type === "doctrine_aware_plan_blocked");
  for (const pf of policyFrictions) {
    const risk: RiskEntry = {
      risk_id: `risk_${Date.now()}_${riskCounter}`,
      plan_id: planId,
      category: "policy_friction",
      description: `Policy friction: ${pf.payload?.reason as string || pf.evidence_id}`,
      severity: "high",
      detected_at: new Date().toISOString(),
    };
    RISKS.set(risk.risk_id, risk);
    newRisks.push(risk);
  }

  for (const r of newRisks) {
    await appendEvidenceRecord({
      evidence_id: hashTraceId(r.risk_id, "plan_risk_ledger_updated"),
      trace_id: r.risk_id,
      job_id: "planning",
      type: "plan_risk_ledger_updated",
      timestamp: r.detected_at,
      payload: {
        risk_id: r.risk_id,
        plan_id: planId,
        category: r.category,
        severity: r.severity,
        description: r.description,
      },
    });
  }

  return newRisks;
}

export function getRisksForPlan(planId: string): RiskEntry[] {
  return Array.from(RISKS.values()).filter((r) => r.plan_id === planId);
}

export function getCriticalRisks(planId: string): RiskEntry[] {
  return Array.from(RISKS.values()).filter(
    (r) => r.plan_id === planId && (r.severity === "critical" || r.severity === "high"),
  );
}
