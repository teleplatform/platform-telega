import type { BudgetState } from "./governance-types.js";
import { getPolicy } from "./governance-policy.js";

const budgets = new Map<string, BudgetState>();

const MAX_CONCURRENT_TASKS = 5;

export function initBudget(taskId: string): BudgetState {
  const state: BudgetState = {
    taskId,
    actionsExecuted: 0,
    actionsBlocked: 0,
    totalCost: 0,
    startedAt: Date.now(),
  };
  budgets.set(taskId, state);
  return { ...state };
}

export function getBudget(taskId: string): BudgetState | undefined {
  return budgets.get(taskId);
}

export function recordExecution(taskId: string, cost = 1): boolean {
  let state = budgets.get(taskId);
  if (!state) state = initBudget(taskId);

  const { maxActionsPerTask } = getPolicy();
  if (state.actionsExecuted >= maxActionsPerTask) {
    return false;
  }

  state.actionsExecuted += 1;
  state.totalCost += cost;
  return true;
}

export function recordBlocked(taskId: string): void {
  let state = budgets.get(taskId);
  if (!state) state = initBudget(taskId);
  state.actionsBlocked += 1;
}

export function canAcceptNewTask(): boolean {
  let running = 0;
  for (const b of budgets.values()) {
    if (b.actionsExecuted > 0) running++;
  }
  return running < MAX_CONCURRENT_TASKS;
}

export function releaseBudget(taskId: string): void {
  budgets.delete(taskId);
}

export function budgetSummary(): string {
  if (budgets.size === 0) return "No active budgets.";
  const lines: string[] = [];
  for (const [taskId, b] of budgets) {
    lines.push(`  ${taskId}: ${b.actionsExecuted} executed, ${b.actionsBlocked} blocked, cost ${b.totalCost}`);
  }
  return `Active budgets: ${budgets.size}\n${lines.join("\n")}`;
}
