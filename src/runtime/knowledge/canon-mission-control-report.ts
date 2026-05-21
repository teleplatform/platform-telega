import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getActiveCanons, getCanonsByCategory } from "./strategic-canon-registry.js";
import { detectCanonConflicts } from "./canon-conflict-detector.js";

export interface CanonReport {
  report_id: string;
  generated_at: string;
  total_canons: number;
  active_canons: number;
  by_category: Record<string, number>;
  recent_changes: number;
  conflicts_found: number;
  superseded: number;
  rendered: string;
}

let reportCounter = 0;

export async function renderCanonReport(): Promise<CanonReport> {
  reportCounter++;
  const active = getActiveCanons();
  const categories = ["architecture", "governance", "safety", "federation",
    "recovery", "epistemic", "economy", "diplomacy"] as const;

  const byCategory: Record<string, number> = {};
  for (const cat of categories) {
    byCategory[cat] = getCanonsByCategory(cat).length;
  }

  const recentChanges = active.filter((c) => {
    const age = Date.now() - new Date(c.updated_at).getTime();
    return age < 7 * 24 * 60 * 60 * 1000;
  }).length;

  let allConflicts = 0;
  for (const c of active) {
    allConflicts += detectCanonConflicts(c).length;
  }

  const superseded = active.filter((c) => c.status === "superseded").length;

  const lines: string[] = [
    "╔══════════════════════════════════════╗",
    "║     STRATEGIC CANON REPORT           ║",
    "╚══════════════════════════════════════╝",
    `Total Active Canons: ${active.length}`,
    `Recent Changes (7d): ${recentChanges}`,
    `Superseded: ${superseded}`,
    `Conflicts: ${allConflicts}`,
    "",
    "--- By Category ---",
    ...Object.entries(byCategory).map(([k, v]) => `  ${k}: ${v}`),
  ];

  const report: CanonReport = {
    report_id: `canon_report_${Date.now()}_${reportCounter}`,
    generated_at: new Date().toISOString(),
    total_canons: active.length + superseded,
    active_canons: active.length,
    by_category: byCategory,
    recent_changes: recentChanges,
    conflicts_found: allConflicts,
    superseded,
    rendered: lines.join("\n"),
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(report.report_id, "canon_report_rendered"),
    trace_id: report.report_id,
    job_id: "knowledge",
    type: "canon_report_rendered",
    timestamp: report.generated_at,
    payload: { report_id: report.report_id, active_canons: active.length, conflicts: allConflicts },
  });

  return report;
}

export async function sendCanonReport(): Promise<CanonReport> {
  const report = await renderCanonReport();

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`${report.report_id}_sent`, "canon_report_sent"),
    trace_id: report.report_id,
    job_id: "knowledge",
    type: "canon_report_sent",
    timestamp: new Date().toISOString(),
    payload: { report_id: report.report_id },
  });

  return report;
}
