import { VerificationRun, VerificationCheck, Verdict, VerificationSummary } from "./verificationTypes";
import { ExecutionRegistry } from "../execution-runner/executionRegistry.js";
import { GovernanceRegistry } from "../governance/outcomeRegistry.js";

const verifications = new Map<string, VerificationRun>();

let counter = 0;
function genId(): string {
  counter++;
  return `ver_${Date.now()}_${counter}`;
}

function determineVerdict(checks: VerificationCheck[]): Verdict {
  const allPassed = checks.every((c) => c.passed);
  const anyFailed = checks.some((c) => !c.passed);
  if (allPassed) return "passed";
  if (anyFailed && checks.length > 2) return "failed";
  return "needs_review";
}

export const VerificationRegistry = {
  create(
    executionRunId: string,
    taskId: string,
    graphId: string,
    checks: VerificationCheck[]
  ): VerificationRun {
    const verdict = determineVerdict(checks);

    const run: VerificationRun = {
      id: genId(),
      executionRunId,
      taskId,
      graphId,
      verdict,
      checks,
      evidenceRefs: [],
      summary: verdict === "passed" ? "All checks passed"
        : verdict === "failed" ? `${checks.filter((c) => !c.passed).length} check(s) failed`
        : "Requires human review",
      createdAt: Date.now(),
      completedAt: null,
    };

    verifications.set(run.id, run);

    // Write evidence
    const evRef = GovernanceRegistry.record(
      verdict === "passed" ? "provider_success" : "provider_failed",
      "verifier" as any,
      verdict === "passed" ? "info" : "warning",
      run.summary,
      { verificationId: run.id, executionRunId, taskId, graphId, checks: checks.length },
      []
    ).outcomeId;
    run.evidenceRefs.push(evRef);

    // Link to execution run
    ExecutionRegistry.addEvidence(executionRunId, evRef);

    return run;
  },

  get(id: string): VerificationRun | undefined {
    return verifications.get(id);
  },

  getAll(): VerificationRun[] {
    return Array.from(verifications.values()).sort((a, b) => b.createdAt - a.createdAt);
  },

  listByExecution(executionRunId: string): VerificationRun[] {
    return Array.from(verifications.values()).filter((v) => v.executionRunId === executionRunId);
  },

  listByTask(taskId: string): VerificationRun[] {
    return Array.from(verifications.values()).filter((v) => v.taskId === taskId);
  },

  listByVerdict(verdict: Verdict): VerificationRun[] {
    return Array.from(verifications.values()).filter((v) => v.verdict === verdict);
  },

  getSummary(): VerificationSummary {
    const all = Array.from(verifications.values());
    return {
      total: all.length,
      passed: all.filter((v) => v.verdict === "passed").length,
      failed: all.filter((v) => v.verdict === "failed").length,
      needsReview: all.filter((v) => v.verdict === "needs_review").length,
    };
  },

  size(): number {
    return verifications.size;
  },
};
