import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { decomposeGoal, type DecomposedGoal } from "../planning/goal-decomposition-system.js";
import { checkPlanAgainstDoctrines } from "../planning/doctrine-aware-planning.js";
import { proposeAutonomousPlan } from "../planning/autonomous-planning-proposal-queue.js";
import { checkRuntimeBudget } from "./runtime-budget-middleware.js";

export interface RealPlanningActivationInput {
  request_text: string;
  route?: string;
  trace_id?: string;
  user_id?: string;
  session_id?: string;
  force?: boolean;
}

export interface RealPlanningActivationResult {
  decision: "activated" | "skipped" | "blocked";
  reason: string;
  trace_id: string;
  plan_id?: string;
  goal?: DecomposedGoal;
  proposal_id?: string;
}

const PLANNING_KEYWORDS = [
  "plan", "roadmap", "break down", "decompose", "architecture", "implement",
  "build", "refactor", "migrate", "release", "long-running", "multi-step",
  "волна", "план", "архитект", "разбей", "реализ", "рефактор", "миграц",
];

export function shouldCreatePlan(requestText: string): boolean {
  const normalized = requestText.toLowerCase();
  if (normalized.length < 180) return false;
  return PLANNING_KEYWORDS.some((k) => normalized.includes(k));
}

export async function activatePlanningForRequest(
  input: RealPlanningActivationInput,
): Promise<RealPlanningActivationResult> {
  const traceId = input.trace_id || hashTraceId(`planning_${Date.now()}`, "real_planning_activation_checked");
  const shouldPlan = input.force || shouldCreatePlan(input.request_text);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, "real_planning_activation_checked"),
    trace_id: traceId,
    job_id: "planning",
    type: "real_planning_activation_checked",
    timestamp: new Date().toISOString(),
    payload: {
      route: input.route,
      user_id: input.user_id,
      session_id: input.session_id,
      request_length: input.request_text.length,
      should_plan: shouldPlan,
    },
  });

  if (!shouldPlan) {
    await appendEvidenceRecord({
      evidence_id: hashTraceId(traceId, "real_planning_skipped"),
      trace_id: traceId,
      job_id: "planning",
      type: "real_planning_skipped",
      timestamp: new Date().toISOString(),
      payload: { reason: "Request is small/simple" },
    });
    return { decision: "skipped", reason: "Request is small/simple", trace_id: traceId };
  }

  const budget = await checkRuntimeBudget({
    action: "planning_action",
    trace_id: traceId,
    units: Math.ceil(input.request_text.length / 1000),
    actor_id: input.user_id,
  });
  if (!budget.allowed) {
    await appendEvidenceRecord({
      evidence_id: hashTraceId(traceId, "real_planning_skipped"),
      trace_id: traceId,
      job_id: "planning",
      type: "real_planning_skipped",
      timestamp: new Date().toISOString(),
      payload: { reason: budget.reason, blocked: true },
    });
    return { decision: "blocked", reason: budget.reason, trace_id: traceId };
  }

  const title = input.request_text.slice(0, 80) || "Runtime request plan";
  const goal = decomposeGoal(title, input.request_text);
  const doctrine = await checkPlanAgainstDoctrines(goal.goal_id, input.request_text);
  if (doctrine.blocked) {
    await appendEvidenceRecord({
      evidence_id: hashTraceId(traceId, "real_planning_skipped"),
      trace_id: traceId,
      job_id: "planning",
      type: "real_planning_skipped",
      timestamp: new Date().toISOString(),
      payload: { reason: doctrine.reason || "Doctrine-aware planning blocked request", plan_id: goal.goal_id, blocked: true },
    });
    return { decision: "blocked", reason: doctrine.reason || "Doctrine-aware planning blocked request", trace_id: traceId, plan_id: goal.goal_id, goal };
  }

  const proposal = await proposeAutonomousPlan(
    title,
    input.request_text,
    goal.phases.map((p) => p.name),
    goal.phases.reduce((sum, phase) => sum + phase.packs.length, 0),
  );

  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, "real_planning_activated"),
    trace_id: traceId,
    job_id: "planning",
    type: "real_planning_activated",
    timestamp: new Date().toISOString(),
    payload: {
      plan_id: goal.goal_id,
      proposal_id: proposal.proposal_id,
      phases: goal.phases.length,
      doctrine_check_id: doctrine.check_id,
    },
  });

  return {
    decision: "activated",
    reason: "Planning activated",
    trace_id: traceId,
    plan_id: goal.goal_id,
    goal,
    proposal_id: proposal.proposal_id,
  };
}
