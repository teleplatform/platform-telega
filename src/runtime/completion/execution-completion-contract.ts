import type { ExecutionEvidenceRecord } from "../evidence/execution-evidence.types.js";
import { getEvidenceByTrace } from "../evidence/execution-evidence-store.js";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export type ExecutionCompletionStatus =
  | "done_verified"
  | "done_unverified"
  | "partial_verified"
  | "partial_unverified"
  | "blocked_policy"
  | "blocked_approval"
  | "failed_execution"
  | "failed_verification"
  | "rolled_back";

const VERIFIED_STATUSES: ExecutionCompletionStatus[] = [
  "done_verified",
  "partial_verified",
];

export function deriveCompletionStatus(records: ExecutionEvidenceRecord[]): ExecutionCompletionStatus {
  if (records.length === 0) return "failed_execution";

  const hasExecutionFinished = records.some(
    (r) => r.type === "execution_finished" && r.lifecycle_state,
  );
  const lifecycleState = records
    .filter((r) => r.type === "execution_finished")
    .pop()?.lifecycle_state;
  const gatesPassed = records.filter((r) => r.type === "validation_gate_passed").length;
  const gatesFailed = records.filter((r) => r.type === "validation_gate_failed").length;
  const hasPolicyBlocked = records.some((r) => r.type === "execution_policy_blocked");
  const hasApprovalBlocked = records.some((r) => r.type === "execution_approval_requested" && !records.some((er) => er.type === "execution_approval_approved" && er.payload?.approval_id === r.payload?.approval_id));
  const hasVerificationPassed = records.some((r) => r.payload?.verification_result === "passed");
  const hasVerificationFailed = records.some((r) => r.payload?.verification_result === "failed");
  const hasRollback = records.some((r) => r.payload?.rollback_executed === true);

  if (hasRollback) return "rolled_back";

  if (hasPolicyBlocked) return "blocked_policy";

  if (hasApprovalBlocked) return "blocked_approval";

  if (!hasExecutionFinished) {
    return "failed_execution";
  }

  if (lifecycleState === "failed" && hasVerificationFailed) {
    return "failed_verification";
  }

  if (lifecycleState === "failed") return "failed_execution";

  if (lifecycleState === "partial" || lifecycleState === "partial_verified") {
    if (gatesPassed > 0 && !hasVerificationFailed) {
      return "partial_verified";
    }
    return "partial_unverified";
  }

  if (lifecycleState === "completed" || lifecycleState === "done" || lifecycleState === "done_verified") {
    if (gatesFailed === 0 && hasVerificationPassed) {
      return "done_verified";
    }
    if (gatesFailed === 0) {
      return "done_unverified";
    }
    if (hasVerificationPassed) {
      return "partial_verified";
    }
    return "partial_unverified";
  }

  if (lifecycleState === "blocked") {
    const blockedByReplay = records.some((r) => r.type === "replay_blocked");
    if (blockedByReplay) return "blocked_approval";
    return "blocked_policy";
  }

  return "failed_execution";
}

export async function declareExecutionCompletion(
  traceId: string,
  jobId: string,
  status: ExecutionCompletionStatus,
  extra?: Record<string, unknown>,
): Promise<void> {
  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, "execution_completion_declared"),
    trace_id: traceId,
    job_id: jobId,
    type: "execution_completion_declared",
    timestamp: new Date().toISOString(),
    lifecycle_state: status,
    payload: {
      status,
      derived_from: "execution-completion-contract",
      ...extra,
    },
  });
}

export async function assertCompletionEvidence(
  traceId: string,
  status: ExecutionCompletionStatus,
): Promise<{ valid: boolean; reasons: string[] }> {
  const reasons: string[] = [];
  const records = getEvidenceByTrace(traceId);

  if (VERIFIED_STATUSES.includes(status)) {
    const hasExecutionFinished = records.some((r) => r.type === "execution_finished");
    if (!hasExecutionFinished) {
      reasons.push("missing execution_finished evidence");
    }

    const allGatesPassed = records.some((r) => r.type === "validation_gate_passed");
    if (!allGatesPassed) {
      reasons.push("missing validation_gate_passed evidence");
    }
  }

  if (status === "done_verified") {
    const hasVerification = records.some(
      (r) => r.payload?.verification_result === "passed",
    );
    if (!hasVerification) {
      reasons.push("done_verified requires verification_passed evidence");
    }
  }

  if (status === "failed_verification") {
    const hasFailedVerification = records.some((r) => r.payload?.verification_result === "failed");
    if (!hasFailedVerification) {
      reasons.push("failed_verification requires verification_failed evidence");
    }
  }

  if (status === "rolled_back") {
    const hasRollback = records.some((r) => r.payload?.rollback_executed === true);
    if (!hasRollback) {
      reasons.push("rolled_back requires rollback_executed evidence");
    }
  }

  if (reasons.length > 0) {
    await appendEvidenceRecord({
      evidence_id: hashTraceId(traceId, "execution_completion_evidence_missing"),
      trace_id: traceId,
      job_id: traceId,
      type: "execution_completion_evidence_missing",
      timestamp: new Date().toISOString(),
      payload: {
        status,
        missing: reasons,
      },
    });
  }

  return { valid: reasons.length === 0, reasons };
}

export async function completeExecution(
  traceId: string,
  jobId: string,
  extra?: Record<string, unknown>,
): Promise<{ status: ExecutionCompletionStatus; valid: boolean; reasons: string[] }> {
  const records = getEvidenceByTrace(traceId);
  const status = deriveCompletionStatus(records);
  await declareExecutionCompletion(traceId, jobId, status, extra);
  const assertion = await assertCompletionEvidence(traceId, status);
  return { status, ...assertion };
}
