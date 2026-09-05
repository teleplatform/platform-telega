import { RepairLoop, RepairAttempt, RepairStatus, RepairResult, DEFAULT_REPAIR_POLICY } from "./repairTypes";
import { classifyFailure, isRetryable, requiresHumanReview } from "./failureClassifier";
import { generatePatch } from "../patch/patchGenerator.js";
import { verifyPatch } from "../patch/verify.js";
import { applyPatch } from "../patch/apply.js";
import { assessPatchRisk } from "../patch/risk.js";
import { createRecoveryPoint } from "../recovery/recoveryPoint.js";
import { buildRollbackPlan } from "../recovery/rollbackPlan.js";
import { executeRollbackPlan } from "../recovery/rollbackExecutor.js";
import { buildResumePlan, resumeGraph } from "../recovery/resumeEngine.js";

let counter = 0;
function genId(): string {
  counter++;
  return `repair_${Date.now()}_${counter}`;
}

function addEvidence(loop: RepairLoop, kind: string, data: unknown): void {
  loop.evidence.push({ kind, data });
}

function createAttempt(loop: RepairLoop): RepairAttempt {
  const attempt: RepairAttempt = {
    attempt: loop.attempts.length + 1,
    status: "inspecting",
    rootCause: null,
    patchGenerated: false,
    verificationPassed: false,
    rollbackUsed: false,
    error: null,
    startedAt: Date.now(),
    completedAt: null,
  };
  loop.attempts.push(attempt);
  return attempt;
}

function updateAttemptStatus(loop: RepairLoop, status: RepairStatus): void {
  const current = loop.attempts[loop.attempts.length - 1];
  if (current) current.status = status;
  loop.status = status;
}

function completeAttempt(loop: RepairLoop, error?: string): void {
  const current = loop.attempts[loop.attempts.length - 1];
  if (current) {
    current.completedAt = Date.now();
    if (error) current.error = error;
  }
}

export async function runRepairLoop(
  graphId: string,
  failedJobNodeId: string,
  errorMessage: string
): Promise<RepairResult> {
  const loop: RepairLoop = {
    id: genId(),
    graphId,
    failedJobNodeId,
    status: "idle",
    attempts: [],
    policy: DEFAULT_REPAIR_POLICY,
    failureClass: classifyFailure(errorMessage),
    lastError: errorMessage,
    evidence: [],
    createdAt: Date.now(),
    completedAt: null,
  };

  addEvidence(loop, "repair.started", { graphId, failedJobNodeId, error: errorMessage });
  const failureClass = loop.failureClass;

  // Check if requires human review
  if (requiresHumanReview(failureClass)) {
    loop.status = "blocked";
    addEvidence(loop, "repair.blocked", { reason: "requires_human_review", failureClass });
    return buildResult(loop);
  }

  for (let attempt = 1; attempt <= loop.policy.maxAttempts; attempt++) {
    const attemptRecord = createAttempt(loop);
    addEvidence(loop, "repair.attempt", { attempt });

    // Phase 1: Inspect — create recovery point
    updateAttemptStatus(loop, "inspecting");
    const recoveryPoint = createRecoveryPoint(graphId, failedJobNodeId, null, `Repair attempt ${attempt}`, [], []);
    addEvidence(loop, "repair.recovery_point", { recoveryPointId: recoveryPoint.id });

    // Phase 2: Analyze — classify failure
    updateAttemptStatus(loop, "analyzing");
    const rootCause = errorMessage;
    attemptRecord.rootCause = rootCause;
    addEvidence(loop, "repair.root_cause", { rootCause, failureClass });

    // Phase 3: Patch — generate patch
    updateAttemptStatus(loop, "patching");
    const patch = generatePatch(
      "unknown",
      rootCause,
      "unknown.ts",
      0,
      {
        nullVars: [],
        typeError: failureClass === "type_error",
      }
    );

    // Check patch risk
    const risk = assessPatchRisk(patch.chunks, patch.symbol, patch.chunks[0]?.file || "unknown.ts");

    if (risk.risk === "critical" && loop.policy.criticalRiskRequiresHuman) {
      loop.status = "blocked";
      addEvidence(loop, "repair.blocked", { reason: "critical_risk_requires_human", risk: risk.risk });
      completeAttempt(loop, "Critical risk — blocked for human review");
      break;
    }

    attemptRecord.patchGenerated = true;
    addEvidence(loop, "repair.patch_generated", { patchId: patch.id, risk: risk.risk });

    // Phase 4: Verify
    updateAttemptStatus(loop, "verifying");
    const verification = await verifyPatch(patch);
    attemptRecord.verificationPassed = verification.verified;
    addEvidence(loop, "repair.verify", { verified: verification.verified, checks: verification });

    if (!verification.verified) {
      // Phase 5: Rollback
      if (loop.policy.rollbackOnVerifyFail) {
        updateAttemptStatus(loop, "rolling_back");
        const rollbackPlan = buildRollbackPlan(recoveryPoint.id, failedJobNodeId, "Verification failed", [], []);
        if (rollbackPlan) {
          executeRollbackPlan(rollbackPlan);
          attemptRecord.rollbackUsed = true;
          addEvidence(loop, "repair.rollback_executed", { planId: rollbackPlan.id });
        }
      }

      // Same error twice check
      if (attempt > 1 && loop.attempts[attempt - 2]?.error === errorMessage && loop.policy.stopOnSameErrorTwice) {
        loop.status = "blocked";
        addEvidence(loop, "repair.blocked", { reason: "same_error_twice" });
        completeAttempt(loop, "Same error occurred twice");
        break;
      }

      // Phase 6: Retry
      if (attempt < loop.policy.maxAttempts && isRetryable(failureClass)) {
        updateAttemptStatus(loop, "retrying");
        resumeGraph(graphId);
        addEvidence(loop, "repair.retrying", { attempt });
        completeAttempt(loop);
        continue;
      }

      completeAttempt(loop, "Max attempts or non-retryable");
      loop.status = "blocked";
      break;
    }

    // Phase 7: Apply
    updateAttemptStatus(loop, "patching");
    const applyResult = await applyPatch(patch);
    addEvidence(loop, "repair.patch_applied", { applied: applyResult.applied, chunks: applyResult.chunksApplied });

    // Phase 8: Retry job
    updateAttemptStatus(loop, "retrying");
    resumeGraph(graphId);
    addEvidence(loop, "repair.retry_executed", { graphId, failedJobNodeId });

    // Done
    loop.status = "done";
    completeAttempt(loop);
    addEvidence(loop, "repair.done", { attempts: attempt });
    break;
  }

  loop.completedAt = Date.now();
  return buildResult(loop);
}

function buildResult(loop: RepairLoop): RepairResult {
  const lastAttempt = loop.attempts[loop.attempts.length - 1];
  return {
    loopId: loop.id,
    status: loop.status,
    attempts: loop.attempts.length,
    rootCause: lastAttempt?.rootCause || null,
    patchApplied: lastAttempt?.patchGenerated || false,
    verificationPassed: lastAttempt?.verificationPassed || false,
    rollbackUsed: lastAttempt?.rollbackUsed || false,
    failureClass: loop.failureClass,
    evidenceCount: loop.evidence.length,
  };
}
