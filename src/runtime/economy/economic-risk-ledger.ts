import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { readEvidenceRecords } from "../evidence/execution-evidence-store.js";

export interface EconomicRisk {
  risk_id: string;
  category: "burn_spike" | "federation_abuse" | "compute_starvation" | "runaway_agent";
  description: string;
  severity: "warning" | "major" | "critical";
  detected_at: string;
}

let riskCounter = 0;

export function detectEconomicRisks(): EconomicRisk[] {
  riskCounter++;
  const evidence = readEvidenceRecords();
  const risks: EconomicRisk[] = [];

  const blockedCosts = evidence.filter((e) => e.type === "cost_governance_blocked");
  if (blockedCosts.length > 3) {
    risks.push({
      risk_id: `eco_risk_${Date.now()}_${riskCounter}`,
      category: "burn_spike",
      description: `${blockedCosts.length} cost governance blocks — potential burn spike`,
      severity: "major",
      detected_at: new Date().toISOString(),
    });
  }

  const federationExchanges = evidence.filter((e) => e.type === "federation_economy_exchanged");
  if (federationExchanges.length > 20) {
    risks.push({
      risk_id: `eco_risk_${Date.now()}_${riskCounter}`,
      category: "federation_abuse",
      description: `${federationExchanges.length} federation exchanges — possible abuse`,
      severity: "warning",
      detected_at: new Date().toISOString(),
    });
  }

  for (const r of risks) {
    appendEvidenceRecord({
      evidence_id: hashTraceId(r.risk_id, "economic_risk_detected"),
      trace_id: r.risk_id,
      job_id: "economy",
      type: "economic_risk_detected",
      timestamp: r.detected_at,
      payload: { risk_id: r.risk_id, category: r.category, severity: r.severity, description: r.description },
    });
  }

  return risks;
}
