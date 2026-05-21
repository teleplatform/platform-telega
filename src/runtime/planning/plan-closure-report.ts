import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getActivePlans } from "./strategic-planning-engine.js";
import { updatePlanProgress } from "./plan-execution-progress-monitor.js";
import { detectPlanDrift } from "./plan-drift-detector.js";
import { readEvidenceRecords } from "../evidence/execution-evidence-store.js";

export interface ClosureReport {
  closure_id: string;
  plan_id: string;
  plan_title: string;
  total_packs_materialized: number;
  total_packs_completed: number;
  failures: number;
  lessons: string[];
  follow_up_canons: string[];
  closed_at: string;
}

let closureCounter = 0;

export async function createClosureReport(planId: string): Promise<ClosureReport> {
  closureCounter++;
  const plans = getActivePlans();
  const plan = plans.find((p) => p.plan_id === planId);
  if (!plan) throw new Error(`Plan ${planId} not found`);

  const progress = await updatePlanProgress(planId);
  const drifts = detectPlanDrift(planId);
  const evidence = readEvidenceRecords();

  const materials = evidence.filter((e) => e.type === "plan_pack_materialized" && e.payload?.plan_id === planId);

  const lessons: string[] = [];
  if (drifts.length > 0) lessons.push(`Plan had ${drifts.length} drifts (${drifts.filter((d) => d.escalated).length} escalated)`);
  if (progress.blocked) lessons.push(`Plan had ${progress.blocked_steps} blocked steps`);
  if (progress.percentage < 100) lessons.push(`Plan completed at ${progress.percentage}% — not all steps finished`);

  const followUpCanons: string[] = [];
  if (progress.blocked) followUpCanons.push("Consider creating recovery canon for blocking patterns");
  if (drifts.some((d) => d.escalated)) followUpCanons.push("Consider creating drift-prevention canon");

  const report: ClosureReport = {
    closure_id: `closure_${Date.now()}_${closureCounter}`,
    plan_id: planId,
    plan_title: plan.title,
    total_packs_materialized: materials.length,
    total_packs_completed: progress.completed_steps,
    failures: progress.blocked_steps + drifts.filter((d) => d.escalated).length,
    lessons,
    follow_up_canons: followUpCanons,
    closed_at: new Date().toISOString(),
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(report.closure_id, "plan_closure_report_created"),
    trace_id: report.closure_id,
    job_id: "planning",
    type: "plan_closure_report_created",
    timestamp: report.closed_at,
    payload: {
      closure_id: report.closure_id,
      plan_id: planId,
      packs: report.total_packs_materialized,
      completed: report.total_packs_completed,
      failures: report.failures,
      lessons: report.lessons.length,
    },
  });

  return report;
}
