import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getActiveCanons, type CanonEntry } from "./strategic-canon-registry.js";

export interface ImpactEntry {
  module: string;
  impact: "high" | "medium" | "low";
  reason: string;
}

export interface CanonImpactReport {
  report_id: string;
  canon_id: string;
  canon_title: string;
  canon_category: string;
  impacted_modules: ImpactEntry[];
  generated_at: string;
}

let impactCounter = 0;

export function analyzeCanonImpact(canon: CanonEntry): CanonImpactReport {
  impactCounter++;

  const moduleMap: Record<string, ImpactEntry[]> = {
    architecture: [
      { module: "src/runtime/", impact: "high", reason: "Architecture canon shapes all runtime modules" },
      { module: "src/runtime/sovereign/", impact: "medium", reason: "May affect sovereignty layer structure" },
    ],
    governance: [
      { module: "src/runtime/constitution/", impact: "high", reason: "Governance canons directly affect constitution rules" },
      { module: "src/runtime/knowledge/", impact: "medium", reason: "Governance canon may require new knowledge types" },
      { module: "src/runtime/sovereign/", impact: "medium", reason: "May impose new sovereignty constraints" },
    ],
    safety: [
      { module: "src/runtime/ethics/", impact: "high", reason: "Safety canon affects ethical validation" },
      { module: "src/runtime/incidents/", impact: "medium", reason: "May add new incident playbooks" },
      { module: "src/runtime/evidence/", impact: "low", reason: "May require additional evidence types" },
    ],
    federation: [
      { module: "src/runtime/federation/", impact: "high", reason: "Federation canon directly targets federation module" },
      { module: "src/runtime/knowledge/", impact: "low", reason: "May require treaty updates" },
    ],
    recovery: [
      { module: "src/runtime/recovery/", impact: "high", reason: "Recovery canon shapes disaster recovery" },
      { module: "src/runtime/continuity/", impact: "high", reason: "Affects continuity restore logic" },
      { module: "src/runtime/blackbox/", impact: "medium", reason: "May require additional recording" },
    ],
    epistemic: [
      { module: "src/runtime/epistemic/", impact: "high", reason: "Epistemic canon directly targets truth/evidence layer" },
      { module: "src/runtime/self/", impact: "medium", reason: "Affects meta-cognition and confidence" },
    ],
    economy: [
      { module: "src/runtime/ops/", impact: "medium", reason: "Economy canon affects operational budgeting" },
    ],
    diplomacy: [
      { module: "src/runtime/diplomacy/", impact: "high", reason: "Diplomacy canon shapes treaty system" },
      { module: "src/runtime/federation/", impact: "medium", reason: "Affects federation relations" },
    ],
  };

  const impacted = moduleMap[canon.category] || [];

  const report: CanonImpactReport = {
    report_id: `impact_${Date.now()}_${impactCounter}`,
    canon_id: canon.canon_id,
    canon_title: canon.title,
    canon_category: canon.category,
    impacted_modules: impacted,
    generated_at: new Date().toISOString(),
  };

  appendEvidenceRecord({
    evidence_id: hashTraceId(report.report_id, "canon_impact_analyzed"),
    trace_id: report.report_id,
    job_id: "knowledge",
    type: "canon_impact_analyzed",
    timestamp: report.generated_at,
    payload: {
      report_id: report.report_id,
      canon_id: canon.canon_id,
      impacted_count: impacted.length,
      high_impact: impacted.filter((i) => i.impact === "high").length,
    },
  });

  return report;
}

export function analyzeAllCanonImpacts(): CanonImpactReport[] {
  const canons = getActiveCanons();
  return canons.map(analyzeCanonImpact);
}
