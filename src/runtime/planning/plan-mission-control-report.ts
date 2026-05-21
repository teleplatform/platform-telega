import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getActivePlans } from "./strategic-planning-engine.js";
import { updatePlanProgress } from "./plan-execution-progress-monitor.js";
import { detectPlanDrift } from "./plan-drift-detector.js";

export interface PlanReport {
  report_id: string;
  plan_id: string;
  plan_title: string;
  progress_percentage: number;
  blockers: number;
  drifts: number;
  escalated_drifts: number;
  rendered: string;
  sent: boolean;
  generated_at: string;
}

let reportCounter = 0;

export async function renderPlanReport(planId: string): Promise<PlanReport> {
  reportCounter++;
  const plans = getActivePlans();
  const plan = plans.find((p) => p.plan_id === planId);
  if (!plan) throw new Error(`Plan ${planId} not found`);

  const progress = await updatePlanProgress(planId);
  const drifts = detectPlanDrift(planId);

  const lines: string[] = [
    "╔══════════════════════════════════════╗",
    "║     PLAN MISSION CONTROL REPORT       ║",
    "╚══════════════════════════════════════╝",
    `Plan: ${plan.title}`,
    `Status: ${plan.status}`,
    `Progress: ${progress.percentage}% (${progress.completed_steps}/${progress.total_steps})`,
    `Blockers: ${progress.blocked_steps}`,
    `Drifts: ${drifts.length} (${drifts.filter((d) => d.escalated).length} escalated)`,
    "",
    "--- Drift Details ---",
    ...drifts.map((d) => `  [${d.severity}] ${d.description}${d.escalated ? " ⚠" : ""}`),
  ];

  const report: PlanReport = {
    report_id: `plan_report_${Date.now()}_${reportCounter}`,
    plan_id: planId,
    plan_title: plan.title,
    progress_percentage: progress.percentage,
    blockers: progress.blocked_steps,
    drifts: drifts.length,
    escalated_drifts: drifts.filter((d) => d.escalated).length,
    rendered: lines.join("\n"),
    sent: false,
    generated_at: new Date().toISOString(),
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(report.report_id, "plan_report_rendered"),
    trace_id: report.report_id,
    job_id: "planning",
    type: "plan_report_rendered",
    timestamp: report.generated_at,
    payload: {
      report_id: report.report_id,
      plan_id: planId,
      progress: progress.percentage,
      blockers: progress.blocked_steps,
      drifts: drifts.length,
    },
  });

  return report;
}

export async function sendPlanReport(planId: string): Promise<PlanReport> {
  const report = await renderPlanReport(planId);
  report.sent = true;

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`${report.report_id}_sent`, "plan_report_sent"),
    trace_id: report.report_id,
    job_id: "planning",
    type: "plan_report_sent",
    timestamp: new Date().toISOString(),
    payload: { report_id: report.report_id, plan_id: planId },
  });

  return report;
}
