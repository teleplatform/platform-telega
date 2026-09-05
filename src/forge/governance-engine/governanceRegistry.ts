import { GovernanceDecision, GovernanceVerdict, GovernanceCheck } from "./engineTypes";

const decisions: GovernanceDecision[] = [];

let counter = 0;
function genId(): string {
  counter++;
  return `gov_${Date.now()}_${counter}`;
}

function determineVerdict(totalScore: number): GovernanceVerdict {
  if (totalScore <= 15) return "allow";
  if (totalScore <= 40) return "review";
  return "block";
}

export const GovernanceRegistry = {
  create(
    checks: GovernanceCheck[],
    taskId?: string,
    graphId?: string,
    executionRunId?: string,
    loopId?: string
  ): GovernanceDecision {
    const totalScore = Math.min(100, Math.max(0, Math.round(checks.reduce((s, c) => s + c.score, 0) / Math.max(1, checks.length))));
    const verdict = determineVerdict(totalScore);
    const highestCheck = checks.reduce((max, c) => c.score > max.score ? c : max, checks[0]);

    const decision: GovernanceDecision = {
      id: genId(),
      taskId: taskId || null,
      graphId: graphId || null,
      executionRunId: executionRunId || null,
      loopId: loopId || null,
      riskScore: totalScore,
      verdict,
      checks,
      reason: verdict === "allow"
        ? `All checks passed (risk: ${totalScore})`
        : verdict === "review"
        ? `Requires review: ${highestCheck.reason} (risk: ${totalScore})`
        : `Blocked: ${highestCheck.reason} (risk: ${totalScore})`,
      requiresApproval: verdict === "review" || verdict === "block",
      approvedById: null,
      evidenceRefs: [],
      createdAt: Date.now(),
    };

    decisions.push(decision);
    return decision;
  },

  get(id: string): GovernanceDecision | undefined {
    return decisions.find((d) => d.id === id);
  },

  getAll(): GovernanceDecision[] {
    return [...decisions].sort((a, b) => b.createdAt - a.createdAt);
  },

  approve(decisionId: string, userId: string): GovernanceDecision | null {
    const decision = decisions.find((d) => d.id === decisionId);
    if (!decision) return null;
    if (decision.verdict === "block") return null;
    decision.approvedById = userId;
    decision.verdict = "allow";
    return decision;
  },

  listByVerdict(verdict: GovernanceVerdict): GovernanceDecision[] {
    return decisions.filter((d) => d.verdict === verdict);
  },

  listByTask(taskId: string): GovernanceDecision[] {
    return decisions.filter((d) => d.taskId === taskId);
  },

  size(): number {
    return decisions.length;
  },
};
