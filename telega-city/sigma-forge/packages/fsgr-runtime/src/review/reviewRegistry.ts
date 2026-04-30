import type { ReviewVerdict, ReviewRole } from "../../fsgr-contracts/src/index.js";

export interface ReviewFn {
  (context: { run_id: string; node_id?: string; artifact_refs: string[]; skill_id?: string }): ReviewVerdict;
}

export interface ReviewRegistry {
  registerReviewer(key: string, fn: ReviewFn): void;
  registerValidator(key: string, fn: ReviewFn): void;
  getReviewer(key: string): ReviewFn | undefined;
  getValidator(key: string): ReviewFn | undefined;
}

export function createReviewRegistry(): ReviewRegistry {
  const reviewers = new Map<string, ReviewFn>();
  const validators = new Map<string, ReviewFn>();

  return {
    registerReviewer(key, fn) { reviewers.set(key, fn); },
    registerValidator(key, fn) { validators.set(key, fn); },
    getReviewer(key) { return reviewers.get(key); },
    getValidator(key) { return validators.get(key); },
  };
}

export function registerDefaultReviewers(registry: ReviewRegistry): void {
  registry.registerReviewer("default", (ctx) => ({
    review_id: `rev_default`,
    run_id: ctx.run_id,
    node_id: ctx.node_id,
    role: "reviewer",
    status: "approved",
    summary: "Default reviewer approved",
    findings: [],
    related_artifact_ids: ctx.artifact_refs,
    created_at: new Date().toISOString(),
  }));

  registry.registerValidator("default", (ctx) => ({
    review_id: `rev_validator_default`,
    run_id: ctx.run_id,
    node_id: ctx.node_id,
    role: "validator",
    status: "approved",
    summary: "Default validator approved",
    findings: [],
    related_artifact_ids: ctx.artifact_refs,
    created_at: new Date().toISOString(),
  }));
}
