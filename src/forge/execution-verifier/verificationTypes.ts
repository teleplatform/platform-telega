export type Verdict = "passed" | "failed" | "needs_review";

export interface VerificationCheck {
  name: string;
  passed: boolean;
  details: string;
}

export interface VerificationRun {
  id: string;
  executionRunId: string;
  taskId: string;
  graphId: string;
  verdict: Verdict;
  checks: VerificationCheck[];
  evidenceRefs: string[];
  summary: string;
  createdAt: number;
  completedAt: number | null;
}

export interface VerificationSummary {
  total: number;
  passed: number;
  failed: number;
  needsReview: number;
}
