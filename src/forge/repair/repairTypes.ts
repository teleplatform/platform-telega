export type RepairStatus =
  | "idle" | "inspecting" | "analyzing" | "patching"
  | "verifying" | "rolling_back" | "retrying" | "done" | "blocked";

export type FailureClass =
  | "type_error" | "test_failure" | "lint_failure"
  | "runtime_exception" | "verification_failed" | "patch_conflict" | "unknown";

export interface RepairAttempt {
  attempt: number;
  status: RepairStatus;
  rootCause: string | null;
  patchGenerated: boolean;
  verificationPassed: boolean;
  rollbackUsed: boolean;
  error: string | null;
  startedAt: number;
  completedAt: number | null;
}

export interface RepairPolicy {
  maxAttempts: number;
  criticalRiskRequiresHuman: boolean;
  highRiskRequiresReview: boolean;
  rollbackOnVerifyFail: boolean;
  stopOnSameErrorTwice: boolean;
}

export interface RepairLoop {
  id: string;
  graphId: string;
  failedJobNodeId: string;
  status: RepairStatus;
  attempts: RepairAttempt[];
  policy: RepairPolicy;
  failureClass: FailureClass;
  lastError: string | null;
  evidence: Array<{ kind: string; data: unknown }>;
  createdAt: number;
  completedAt: number | null;
}

export interface RepairResult {
  loopId: string;
  status: RepairStatus;
  attempts: number;
  rootCause: string | null;
  patchApplied: boolean;
  verificationPassed: boolean;
  rollbackUsed: boolean;
  failureClass: FailureClass;
  evidenceCount: number;
}

export const DEFAULT_REPAIR_POLICY: RepairPolicy = {
  maxAttempts: 3,
  criticalRiskRequiresHuman: true,
  highRiskRequiresReview: true,
  rollbackOnVerifyFail: true,
  stopOnSameErrorTwice: true,
};
