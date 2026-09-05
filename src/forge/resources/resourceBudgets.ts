import { ResourceSnapshot, ResourceBudget, ResourceDecision } from "./resourceTypes";

const budgets: ResourceBudget[] = [];

let counter = 0;
function genId(): string {
  counter++;
  return `budget_${Date.now()}_${counter}`;
}

export function createBudget(
  missionId: string,
  maxCostUsd: number,
  maxRamPercent: number,
  maxCpuPercent: number,
  maxConcurrentJobs: number,
  maxTokensPerDay: number
): ResourceBudget {
  const budget: ResourceBudget = {
    budgetId: genId(),
    missionId,
    maxCostUsd,
    maxRamPercent,
    maxCpuPercent,
    maxConcurrentJobs,
    maxTokensPerDay,
    createdAt: Date.now(),
  };
  budgets.push(budget);
  return budget;
}

export function getBudget(missionId: string): ResourceBudget | undefined {
  return budgets.find((b) => b.missionId === missionId);
}

export function getAllBudgets(): ResourceBudget[] {
  return [...budgets];
}

export function evaluateResources(
  snapshot: ResourceSnapshot,
  budget?: ResourceBudget,
  modelRamGb?: number
): ResourceDecision {
  const reasons: string[] = [];
  let allowed = true;

  // RAM check
  if (budget && snapshot.ramPercent > budget.maxRamPercent) {
    reasons.push(`RAM ${snapshot.ramPercent}% exceeds budget max ${budget.maxRamPercent}%`);
    allowed = false;
  } else if (snapshot.ramPercent > 92) {
    reasons.push(`Critical RAM: ${snapshot.ramPercent}% — system overload`);
    allowed = false;
  } else if (snapshot.ramPercent > 85 && modelRamGb && modelRamGb > 2) {
    reasons.push(`RAM at ${snapshot.ramPercent}% — insufficient for ${modelRamGb}GB model`);
    allowed = false;
  }

  // CPU check
  if (budget && snapshot.cpuPercent > budget.maxCpuPercent) {
    reasons.push(`CPU ${snapshot.cpuPercent}% exceeds budget max ${budget.maxCpuPercent}%`);
    allowed = false;
  } else if (snapshot.cpuPercent > 95) {
    reasons.push(`Critical CPU: ${snapshot.cpuPercent}%`);
    allowed = false;
  }

  // Swap check
  if (snapshot.swapPercent > 60) {
    reasons.push(`Swap at ${snapshot.swapPercent}% — memory pressure critical`);
    allowed = false;
  } else if (snapshot.swapPercent > 40) {
    reasons.push(`Swap at ${snapshot.swapPercent}% — prefer lightweight model`);
    if (modelRamGb && modelRamGb > 4) {
      reasons.push(`Heavy model (${modelRamGb}GB) not recommended under swap pressure`);
      allowed = false;
    }
  }

  // Concurrency check
  if (budget && snapshot.activeJobs >= budget.maxConcurrentJobs) {
    reasons.push(`Active jobs ${snapshot.activeJobs} >= max ${budget.maxConcurrentJobs}`);
    allowed = false;
  }

  // Generate recommendation
  let recommendation: string | null = null;
  if (!allowed) {
    if (snapshot.ramPercent > 85) recommendation = "Free RAM or use lightweight model";
    else if (snapshot.cpuPercent > 90) recommendation = "Wait for CPU idle or reduce concurrent tasks";
    else if (snapshot.swapPercent > 40) recommendation = "Close memory-heavy applications";
    else recommendation = "Reduce resource usage or upgrade hardware";
  }

  return {
    allowed,
    reason: reasons.length > 0 ? reasons.join("; ") : "Resources sufficient",
    recommendation,
    snapshot,
    timestamp: Date.now(),
  };
}
