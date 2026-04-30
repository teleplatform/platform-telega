import type { EvidenceLink } from "../storage/sqlite/evidenceRepo.js";
import { randomUUID } from "crypto";
import { nowIso } from "../utils/now.js";

export interface EvidenceRepoLike {
  appendEvidenceLink(link: EvidenceLink): void;
  listEvidenceLinksByRun(run_id: string): EvidenceLink[];
  listEvidenceLinksByArtifact(artifact_id: string): EvidenceLink[];
}

export function buildEvidenceContinuity(evidenceRepo: EvidenceRepoLike, run_id: string) {
  const links = evidenceRepo.listEvidenceLinksByRun(run_id);
  return {
    run_id,
    total_links: links.length,
    links,
  };
}

export function traceArtifactLineage(evidenceRepo: EvidenceRepoLike, artifact_id: string): EvidenceLink[] {
  return evidenceRepo.listEvidenceLinksByArtifact(artifact_id);
}

export function linkEventToArtifact(evidenceRepo: EvidenceRepoLike, run_id: string, event_id: string, artifact_id: string): void {
  evidenceRepo.appendEvidenceLink({
    link_id: `link_${randomUUID()}`,
    run_id,
    from_kind: "event",
    from_id: event_id,
    to_kind: "artifact",
    to_id: artifact_id,
    relation: "produced_by",
    created_at: nowIso(),
  });
}

export function linkArtifactToReview(evidenceRepo: EvidenceRepoLike, run_id: string, artifact_id: string, review_id: string): void {
  evidenceRepo.appendEvidenceLink({
    link_id: `link_${randomUUID()}`,
    run_id,
    from_kind: "artifact",
    from_id: artifact_id,
    to_kind: "review",
    to_id: review_id,
    relation: "reviewed_by",
    created_at: nowIso(),
  });
}

export function linkRunToMemory(evidenceRepo: EvidenceRepoLike, run_id: string, memory_id: string): void {
  evidenceRepo.appendEvidenceLink({
    link_id: `link_${randomUUID()}`,
    run_id,
    from_kind: "run",
    from_id: run_id,
    to_kind: "memory",
    to_id: memory_id,
    relation: "recorded_as",
    created_at: nowIso(),
  });
}

export function linkReviewToMemory(evidenceRepo: EvidenceRepoLike, run_id: string, review_id: string, memory_id: string): void {
  evidenceRepo.appendEvidenceLink({
    link_id: `link_${randomUUID()}`,
    run_id,
    from_kind: "review",
    from_id: review_id,
    to_kind: "memory",
    to_id: memory_id,
    relation: "memorized_as",
    created_at: nowIso(),
  });
}
