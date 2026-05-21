import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export type PlanPriority = "critical" | "high" | "medium" | "low";
export type PlanStatus = "draft" | "active" | "paused" | "completed" | "abandoned";

export interface StrategicPlan {
  plan_id: string;
  title: string;
  description: string;
  phases: string[];
  priority: PlanPriority;
  status: PlanStatus;
  dependencies: string[];
  created_at: string;
  updated_at: string;
}

const PLANS: Map<string, StrategicPlan> = new Map();
let planCounter = 0;

export async function createStrategicPlan(
  title: string,
  description: string,
  phases: string[],
  priority: PlanPriority = "medium",
  dependencies: string[] = [],
): Promise<StrategicPlan> {
  planCounter++;
  const plan: StrategicPlan = {
    plan_id: `plan_${Date.now()}_${planCounter}`,
    title,
    description,
    phases,
    priority,
    status: "draft",
    dependencies,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  PLANS.set(plan.plan_id, plan);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(plan.plan_id, "strategic_plan_created"),
    trace_id: plan.plan_id,
    job_id: "planning",
    type: "strategic_plan_created",
    timestamp: plan.created_at,
    payload: { plan_id: plan.plan_id, title, phases: phases.length, priority },
  });

  return plan;
}

export async function updateStrategicPlan(
  planId: string,
  updates: Partial<Pick<StrategicPlan, "status" | "description" | "phases" | "dependencies">>,
): Promise<StrategicPlan | null> {
  const plan = PLANS.get(planId);
  if (!plan) return null;

  if (updates.status) plan.status = updates.status;
  if (updates.description) plan.description = updates.description;
  if (updates.phases) plan.phases = updates.phases;
  if (updates.dependencies) plan.dependencies = updates.dependencies;
  plan.updated_at = new Date().toISOString();

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`${planId}_upd`, "strategic_plan_updated"),
    trace_id: planId,
    job_id: "planning",
    type: "strategic_plan_updated",
    timestamp: plan.updated_at,
    payload: { plan_id: planId, status: plan.status, phases: plan.phases.length },
  });

  return plan;
}

export function getPlan(planId: string): StrategicPlan | null {
  return PLANS.get(planId) || null;
}

export function getActivePlans(): StrategicPlan[] {
  return Array.from(PLANS.values()).filter((p) => p.status === "active" || p.status === "draft");
}
