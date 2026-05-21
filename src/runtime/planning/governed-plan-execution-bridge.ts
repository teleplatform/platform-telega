import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getPlan } from "./strategic-planning-engine.js";
import { checkPlanAgainstDoctrines } from "./doctrine-aware-planning.js";

export interface GovernedExecution {
  execution_id: string;
  plan_id: string;
  started_at: string;
  blocked: boolean;
  reason?: string;
}

let executionCounter = 0;

export async function startGovernedExecution(planId: string): Promise<GovernedExecution> {
  executionCounter++;
  const plan = getPlan(planId);
  if (!plan) throw new Error(`Plan ${planId} not found`);

  const doctrineCheck = await checkPlanAgainstDoctrines(planId, plan.description);

  if (doctrineCheck.blocked) {
    const result: GovernedExecution = {
      execution_id: `exec_${Date.now()}_${executionCounter}`,
      plan_id: planId,
      started_at: new Date().toISOString(),
      blocked: true,
      reason: doctrineCheck.reason || "Doctrine check failed",
    };

    await appendEvidenceRecord({
      evidence_id: hashTraceId(result.execution_id, "governed_plan_execution_blocked"),
      trace_id: result.execution_id,
      job_id: "planning",
      type: "governed_plan_execution_blocked",
      timestamp: result.started_at,
      payload: {
        execution_id: result.execution_id,
        plan_id: planId,
        reason: result.reason,
      },
    });

    return result;
  }

  const result: GovernedExecution = {
    execution_id: `exec_${Date.now()}_${executionCounter}`,
    plan_id: planId,
    started_at: new Date().toISOString(),
    blocked: false,
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(result.execution_id, "governed_plan_execution_started"),
    trace_id: result.execution_id,
    job_id: "planning",
    type: "governed_plan_execution_started",
    timestamp: result.started_at,
    payload: {
      execution_id: result.execution_id,
      plan_id: planId,
      plan_title: plan.title,
    },
  });

  return result;
}
