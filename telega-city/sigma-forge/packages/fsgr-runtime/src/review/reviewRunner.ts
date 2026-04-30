import type { ReviewVerdict, ReviewChain } from "../../fsgr-contracts/src/index.js";
import type { ReviewRegistry, ReviewFn } from "./reviewRegistry.js";
import { createReviewVerdict } from "./reviewContracts.js";

export interface ReviewsRepoLike {
  saveReview(verdict: ReviewVerdict): void;
  listReviewsByRun(run_id: string): ReviewVerdict[];
  listReviewsByNode(run_id: string, node_id: string): ReviewVerdict[];
  getLatestReviewByRole(run_id: string, node_id: string | undefined, role: string): ReviewVerdict | null;
}

export async function runReviewer(
  registry: ReviewRegistry,
  reviewsRepo: ReviewsRepoLike,
  run_id: string,
  node_id: string,
  artifactRefs: string[],
  skill_id?: string
): Promise<ReviewVerdict> {
  const reviewer = registry.getReviewer(skill_id ?? "default") ?? registry.getReviewer("default");
  if (!reviewer) {
    throw new Error("No reviewer registered");
  }

  const verdict = reviewer({ run_id, node_id, artifact_refs: artifactRefs, skill_id });
  reviewsRepo.saveReview(verdict);
  return verdict;
}

export async function runReviewValidator(
  registry: ReviewRegistry,
  reviewsRepo: ReviewsRepoLike,
  run_id: string,
  node_id: string,
  artifactRefs: string[],
  skill_id?: string
): Promise<ReviewVerdict> {
  const validator = registry.getValidator(skill_id ?? "default") ?? registry.getValidator("default");
  if (!validator) {
    throw new Error("No validator registered");
  }

  const verdict = validator({ run_id, node_id, artifact_refs: artifactRefs, skill_id });
  reviewsRepo.saveReview(verdict);
  return verdict;
}

export function buildReviewChain(
  reviewsRepo: ReviewsRepoLike,
  run_id: string,
  node_id?: string
): ReviewChain {
  const reviews = node_id
    ? reviewsRepo.listReviewsByNode(run_id, node_id)
    : reviewsRepo.listReviewsByRun(run_id);

  const reviewerVerdict = reviews.find((r) => r.role === "reviewer");
  const validatorVerdict = reviews.find((r) => r.role === "validator");

  return {
    run_id,
    node_id,
    reviewer_verdict: reviewerVerdict,
    validator_verdict: validatorVerdict,
  };
}
