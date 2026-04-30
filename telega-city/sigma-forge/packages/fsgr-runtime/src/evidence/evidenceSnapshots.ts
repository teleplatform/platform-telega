import type { ReviewVerdict } from "../../fsgr-contracts/src/index.js";

export interface ReviewsRepoLike {
  listReviewsByRun(run_id: string): ReviewVerdict[];
}

export interface MemoriesRepoLike {
  listMemoriesByRun(run_id: string): any[];
}

export interface EvidenceRepoLike {
  listEvidenceLinksByRun(run_id: string): any[];
}

export function buildRunEvidenceSnapshot(
  reviewsRepo: ReviewsRepoLike,
  memoriesRepo: MemoriesRepoLike,
  evidenceRepo: EvidenceRepoLike,
  run_id: string
) {
  const reviews = reviewsRepo.listReviewsByRun(run_id);
  const memories = memoriesRepo.listMemoriesByRun(run_id);
  const evidenceLinks = evidenceRepo.listEvidenceLinksByRun(run_id);

  return {
    run_id,
    reviews_count: reviews.length,
    memories_count: memories.length,
    evidence_links_count: evidenceLinks.length,
    reviews,
    memories,
    evidence_links: evidenceLinks,
  };
}
