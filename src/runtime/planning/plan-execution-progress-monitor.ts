import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { getBlockedDependencies } from "./plan-execution-dependency-tracker.js";

export interface PlanProgress {
  progress_id: string;
  plan_id: string;
  total_steps: number;
  completed_steps: number;
  blocked_steps: number;
  percentage: number;
  blocked: boolean;
  updated_at: string;
}

let progressCounter = 0;

export async function updatePlanProgress(planId: string): Promise<PlanProgress> {
  progressCounter++;
  const evidence = readEvidenceRecords();
  const planEvents = evidence.filter((e) => e.payload?.plan_id === planId || e.trace_id === planId);

  const totalSteps = planEvents.length || 1;
  const completedTypes = ["governed_plan_execution_started", "plan_pack_materialized",
    "plan_dependency_status_updated", "plan_progress_updated"];
  const completedSteps = planEvents.filter((e) => completedTypes.includes(e.type)).length;
  const blockedSteps = getBlockedDependencies(planId).length;

  const percentage = Math.round((completedSteps / totalSteps) * 100);
  const blocked = blockedSteps > 0;

  const progress: PlanProgress = {
    progress_id: `progress_${Date.now()}_${progressCounter}`,
    plan_id: planId,
    total_steps: totalSteps,
    completed_steps: completedSteps,
    blocked_steps: blockedSteps,
    percentage,
    blocked,
    updated_at: new Date().toISOString(),
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(progress.progress_id, blocked ? "plan_progress_blocked" : "plan_progress_updated"),
    trace_id: progress.progress_id,
    job_id: "planning",
    type: blocked ? "plan_progress_blocked" : "plan_progress_updated",
    timestamp: progress.updated_at,
    payload: {
      progress_id: progress.progress_id,
      plan_id: planId,
      percentage,
      completed: completedSteps,
      total: totalSteps,
      blocked: blockedSteps > 0,
    },
  });

  return progress;
}
