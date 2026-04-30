import type { ReviewVerdict } from "../../fsgr-contracts/src/index.js";

export interface ReviewsRepoLike {
  listReviewsByRun(run_id: string): ReviewVerdict[];
  listReviewsByNode(run_id: string, node_id: string): ReviewVerdict[];
}

export function buildRunReviewSummary(reviewsRepo: ReviewsRepoLike, run_id: string) {
  const reviews = reviewsRepo.listReviewsByRun(run_id);
  return {
    run_id,
    total_reviews: reviews.length,
    reviewer_verdicts: reviews.filter((r) => r.role === "reviewer"),
    validator_verdicts: reviews.filter((r) => r.role === "validator"),
    has_rejections: reviews.some((r) => r.status === "rejected"),
    has_warnings: reviews.some((r) => r.status === "warning"),
  };
}

export function buildNodeReviewSummary(reviewsRepo: ReviewsRepoLike, run_id: string, node_id: string) {
  const reviews = reviewsRepo.listReviewsByNode(run_id, node_id);
  return {
    run_id,
    node_id,
    total_reviews: reviews.length,
    latest_reviewer: reviews.find((r) => r.role === "reviewer"),
    latest_validator: reviews.find((r) => r.role === "validator"),
  };
}
