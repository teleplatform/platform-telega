import type { ReviewRole, ReviewVerdict, ReviewFinding } from "../../fsgr-contracts/src/index.js";
import { randomUUID } from "crypto";
import { nowIso } from "../utils/now.js";

export function isValidReviewRole(role: string): role is ReviewRole {
  return ["worker", "reviewer", "validator"].includes(role);
}

export function isValidReviewStatus(status: string): boolean {
  return ["approved", "rejected", "warning"].includes(status);
}

export function createReviewVerdict(params: {
  run_id: string;
  node_id?: string;
  role: ReviewRole;
  status: "approved" | "rejected" | "warning";
  summary: string;
  findings?: ReviewFinding[];
  related_artifact_ids?: string[];
}): ReviewVerdict {
  return {
    review_id: `rev_${randomUUID()}`,
    run_id: params.run_id,
    node_id: params.node_id,
    role: params.role,
    status: params.status,
    summary: params.summary,
    findings: params.findings ?? [],
    related_artifact_ids: params.related_artifact_ids ?? [],
    created_at: nowIso(),
  };
}
