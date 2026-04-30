export type ReviewRole = "worker" | "reviewer" | "validator";

export interface ReviewFinding {
  code: string;
  severity: "low" | "medium" | "high";
  message: string;
}

export interface ReviewVerdict {
  review_id: string;
  run_id: string;
  node_id?: string;
  role: ReviewRole;
  status: "approved" | "rejected" | "warning";
  summary: string;
  findings: ReviewFinding[];
  related_artifact_ids: string[];
  created_at: string;
}

export interface ReviewChain {
  run_id: string;
  node_id?: string;
  worker_output_ref?: string;
  reviewer_verdict?: ReviewVerdict;
  validator_verdict?: ReviewVerdict;
}
