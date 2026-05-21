import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getAllBudgets, consumeBudget } from "./runtime-budget-engine.js";

export interface CostCheck {
  check_id: string;
  approved: boolean;
  reason?: string;
  checked_at: string;
}

let checkCounter = 0;

export async function checkCostGovernance(
  category: string,
  requiredAmount: number,
): Promise<CostCheck> {
  checkCounter++;
  const budgets = getAllBudgets();
  const budget = budgets.find((b) => b.category === category);

  let approved = true;
  let reason: string | undefined;

  if (!budget) {
    approved = false;
    reason = `No budget defined for ${category}`;
  } else if (budget.used + requiredAmount > budget.limit) {
    approved = false;
    reason = `Budget ${category} exhausted (${budget.used}/${budget.limit})`;
  }

  if (approved) {
    consumeBudget(category as any, requiredAmount);
  }

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`cost_${checkCounter}`, approved ? "cost_governance_checked" : "cost_governance_blocked"),
    trace_id: `cost_${checkCounter}`,
    job_id: "economy",
    type: approved ? "cost_governance_checked" : "cost_governance_blocked",
    timestamp: new Date().toISOString(),
    payload: { check_id: `cost_${checkCounter}`, category, required: requiredAmount, approved, reason },
  });

  return { check_id: `cost_${checkCounter}`, approved, reason, checked_at: new Date().toISOString() };
}
