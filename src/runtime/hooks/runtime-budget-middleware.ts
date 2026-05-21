import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import {
  consumeBudget,
  getBudget,
  initializeBudgets,
  type BudgetCategory,
} from "../economy/runtime-budget-engine.js";
import { checkRuntimeDecisionPoint } from "./runtime-decision-point-registry.js";
import { checkRuntimeMode } from "./runtime-mode-enforcement-hook.js";

export type RuntimeBudgetActionKind =
  | "model_call"
  | "api_call"
  | "replay"
  | "browser_action"
  | "federation_action"
  | "planning_action"
  | "media_action"
  | "shell_action";

export interface RuntimeBudgetInput {
  action: RuntimeBudgetActionKind;
  units?: number;
  trace_id?: string;
  task_id?: string;
  actor_id?: string;
  metadata?: Record<string, unknown>;
  mode?: "public" | "creator";
}

export interface RuntimeBudgetResult {
  allowed: boolean;
  category: BudgetCategory;
  estimated_cost: number;
  remaining: number;
  reason: string;
}

let budgetCheckCounter = 0;
let budgetsInitialized = false;

function ensureBudgets(): void {
  if (budgetsInitialized) return;
  if (getBudget("compute") === null) {
    initializeBudgets();
  }
  budgetsInitialized = true;
}

function categoryForAction(action: RuntimeBudgetActionKind): BudgetCategory {
  switch (action) {
    case "replay":
      return "replay";
    case "federation_action":
      return "federation";
    case "planning_action":
      return "planning";
    case "media_action":
      return "storage";
    case "browser_action":
    case "shell_action":
    case "model_call":
    case "api_call":
    default:
      return "compute";
  }
}

export function estimateRuntimeCost(input: RuntimeBudgetInput): { category: BudgetCategory; cost: number } {
  const units = Math.max(1, input.units || 1);
  const base: Record<RuntimeBudgetActionKind, number> = {
    model_call: 5,
    api_call: 2,
    replay: 5,
    browser_action: 3,
    federation_action: 10,
    planning_action: 4,
    media_action: 8,
    shell_action: 3,
  };
  return { category: categoryForAction(input.action), cost: base[input.action] * units };
}

export async function checkRuntimeBudget(input: RuntimeBudgetInput): Promise<RuntimeBudgetResult> {
  ensureBudgets();
  budgetCheckCounter++;
  const traceId = input.trace_id || hashTraceId(`budget_${budgetCheckCounter}`, "runtime_budget_middleware_checked");
  await checkRuntimeDecisionPoint({
    kind: "budget_check",
    trace_id: traceId,
    actor_id: input.actor_id,
    context: { action: input.action },
  });
  const mode = await checkRuntimeMode({
    mode: input.mode,
    action: "budget",
    risk: ["federation_action", "replay", "shell_action"].includes(input.action) ? "high" : "low",
    trace_id: traceId,
    actor_id: input.actor_id,
  });
  const { category, cost } = estimateRuntimeCost(input);
  const budget = getBudget(category);
  const remaining = budget ? Math.max(0, budget.limit - budget.used) : 0;
  const allowed = !!budget && remaining >= cost && mode.decision === "allowed";
  const reason = allowed
    ? "Runtime budget available"
    : mode.decision === "blocked"
      ? mode.reason
      : budget
      ? `Runtime budget exhausted for ${category} (${budget.used}/${budget.limit}, required ${cost})`
      : `No runtime budget defined for ${category}`;

  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, allowed ? "runtime_budget_middleware_checked" : "runtime_budget_middleware_blocked"),
    trace_id: traceId,
    job_id: input.task_id || "budget",
    type: allowed ? "runtime_budget_middleware_checked" : "runtime_budget_middleware_blocked",
    timestamp: new Date().toISOString(),
    payload: {
      action: input.action,
      category,
      estimated_cost: cost,
      remaining,
      allowed,
      actor_id: input.actor_id,
      metadata: input.metadata,
    },
  });

  return { allowed, category, estimated_cost: cost, remaining, reason };
}

export async function consumeRuntimeBudget(input: RuntimeBudgetInput): Promise<RuntimeBudgetResult> {
  const checked = await checkRuntimeBudget(input);
  const traceId = input.trace_id || hashTraceId(`budget_${budgetCheckCounter}`, "runtime_budget_consumed");
  if (!checked.allowed) return checked;

  const consumed = consumeBudget(checked.category, checked.estimated_cost);
  const budget = getBudget(checked.category);
  const remaining = budget ? Math.max(0, budget.limit - budget.used) : 0;

  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, consumed ? "runtime_budget_consumed" : "runtime_budget_middleware_blocked"),
    trace_id: traceId,
    job_id: input.task_id || "budget",
    type: consumed ? "runtime_budget_consumed" : "runtime_budget_middleware_blocked",
    timestamp: new Date().toISOString(),
    payload: {
      action: input.action,
      category: checked.category,
      consumed: checked.estimated_cost,
      remaining,
      actor_id: input.actor_id,
    },
  });

  return {
    ...checked,
    allowed: consumed,
    remaining,
    reason: consumed ? "Runtime budget consumed" : `Runtime budget exhausted for ${checked.category}`,
  };
}
