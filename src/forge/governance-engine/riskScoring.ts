import { GovernanceCheck, RiskCategory } from "./engineTypes";
import { ExecutionRegistry } from "../execution-runner/executionRegistry.js";

export function scoreProviderRisk(providerId?: string): GovernanceCheck {
  let score = 10;
  let reason = "Default provider";

  if (!providerId) {
    score = 30;
    reason = "No provider specified";
  } else if (providerId.includes("local:")) {
    score = 5;
    reason = `Local provider (${providerId}) — low risk`;
  } else if (providerId.includes("openai") || providerId.includes("deepseek")) {
    score = 20;
    reason = `Cloud provider (${providerId}) — medium risk`;
  }

  return { category: "provider_risk", score, reason };
}

export function scoreExecutionRisk(executionRunId?: string): GovernanceCheck {
  let score = 15;

  if (!executionRunId) return { category: "execution_risk", score: 25, reason: "No execution context" };

  const run = ExecutionRegistry.get(executionRunId);
  if (!run) return { category: "execution_risk", score: 20, reason: "Execution not found" };

  if (run.status === "failed") score = 40;
  else if (run.status === "completed") score = 5;
  else score = 15;

  return {
    category: "execution_risk",
    score,
    reason: run.status === "failed" ? `Previous execution failed: ${run.error}` : `Execution status: ${run.status}`,
  };
}

export function scoreRetryRisk(retryCount?: number): GovernanceCheck {
  if (!retryCount || retryCount === 0) {
    return { category: "retry_risk", score: 5, reason: "First attempt" };
  }
  if (retryCount === 1) return { category: "retry_risk", score: 20, reason: "Second attempt" };
  if (retryCount === 2) return { category: "retry_risk", score: 40, reason: "Third attempt" };
  return { category: "retry_risk", score: 70, reason: `${retryCount} retries — high risk` };
}

export function scoreLoopRisk(loopStepCount?: number): GovernanceCheck {
  if (!loopStepCount || loopStepCount <= 3) {
    return { category: "loop_risk", score: 5, reason: `Step ${loopStepCount || 0} of loop` };
  }
  if (loopStepCount <= 6) return { category: "loop_risk", score: 20, reason: `Step ${loopStepCount} — moderate depth` };
  if (loopStepCount <= 10) return { category: "loop_risk", score: 40, reason: `Step ${loopStepCount} — deep loop` };
  return { category: "loop_risk", score: 60, reason: `Step ${loopStepCount} — near loop limit` };
}

export function evaluateGovernance(params: {
  taskId?: string;
  graphId?: string;
  executionRunId?: string;
  loopId?: string;
  providerId?: string;
  retryCount?: number;
  loopStepCount?: number;
}): { checks: GovernanceCheck[]; totalScore: number } {
  const checks: GovernanceCheck[] = [
    scoreProviderRisk(params.providerId),
    scoreExecutionRisk(params.executionRunId),
    scoreRetryRisk(params.retryCount),
    scoreLoopRisk(params.loopStepCount),
  ];

  const totalScore = Math.round(checks.reduce((s, c) => s + c.score, 0) / checks.length);
  return { checks, totalScore };
}
