import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export type BudgetCategory = "compute" | "memory" | "gpu" | "storage" | "replay" | "federation" | "planning";

export interface BudgetAllocation {
  budget_id: string;
  category: BudgetCategory;
  limit: number;
  used: number;
  period: "hourly" | "daily" | "monthly";
  defined_at: string;
}

const BUDGETS: Map<string, BudgetAllocation> = new Map();
let budgetCounter = 0;

const DEFAULT_BUDGETS: Array<Omit<BudgetAllocation, "budget_id" | "defined_at">> = [
  { category: "compute", limit: 1000, used: 0, period: "daily" },
  { category: "memory", limit: 4096, used: 0, period: "daily" },
  { category: "gpu", limit: 8, used: 0, period: "daily" },
  { category: "storage", limit: 10240, used: 0, period: "monthly" },
  { category: "replay", limit: 100, used: 0, period: "daily" },
  { category: "federation", limit: 500, used: 0, period: "daily" },
  { category: "planning", limit: 50, used: 0, period: "daily" },
];

export function initializeBudgets(): void {
  for (const b of DEFAULT_BUDGETS) {
    const id = `budget_${b.category}_${Date.now()}`;
    BUDGETS.set(id, { ...b, budget_id: id, defined_at: new Date().toISOString() });
  }
}

export async function defineBudget(
  category: BudgetCategory,
  limit: number,
  period: BudgetAllocation["period"],
): Promise<BudgetAllocation> {
  budgetCounter++;
  const budget: BudgetAllocation = {
    budget_id: `budget_${Date.now()}_${budgetCounter}`,
    category,
    limit,
    used: 0,
    period,
    defined_at: new Date().toISOString(),
  };
  BUDGETS.set(budget.budget_id, budget);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(budget.budget_id, "runtime_budget_defined"),
    trace_id: budget.budget_id,
    job_id: "economy",
    type: "runtime_budget_defined",
    timestamp: budget.defined_at,
    payload: { budget_id: budget.budget_id, category, limit, period },
  });
  return budget;
}

export function getBudget(category: BudgetCategory): BudgetAllocation | null {
  return Array.from(BUDGETS.values()).find((b) => b.category === category) || null;
}

export function getAllBudgets(): BudgetAllocation[] {
  return Array.from(BUDGETS.values());
}

export function consumeBudget(category: BudgetCategory, amount: number): boolean {
  const budget = getBudget(category);
  if (!budget) return false;
  if (budget.used + amount > budget.limit) return false;
  budget.used += amount;
  return true;
}
