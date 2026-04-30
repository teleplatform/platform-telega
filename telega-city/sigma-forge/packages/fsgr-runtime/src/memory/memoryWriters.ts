import type { MemoryRecord } from "../../fsgr-contracts/src/index.js";
import type { MemoryStore } from "./memoryStore.js";
import { makeRunScopeKey, makeWorkspaceScopeKey, makeOperatorScopeKey, makeCanonScopeKey } from "./memoryKeys.js";

export function writeRunSummaryMemory(memoryStore: MemoryStore, run_id: string, summary: string): void {
  memoryStore.writeMemory(memoryStore.createMemoryRecord({
    layer: "run",
    scope_key: makeRunScopeKey(run_id),
    record_key: "run_summary",
    title: `Run ${run_id} Summary`,
    content: summary,
    tags: ["run", "summary"],
    source_run_id: run_id,
    importance: "medium",
  }));
}

export function writeArtifactMemory(memoryStore: MemoryStore, run_id: string, artifact_id: string, title: string, content: string): void {
  memoryStore.writeMemory(memoryStore.createMemoryRecord({
    layer: "run",
    scope_key: makeRunScopeKey(run_id),
    record_key: `artifact:${artifact_id}`,
    title,
    content,
    tags: ["artifact", "output"],
    source_run_id: run_id,
    source_artifact_id: artifact_id,
    importance: "medium",
  }));
}

export function writeReviewMemory(memoryStore: MemoryStore, run_id: string, review_id: string, role: string, summary: string): void {
  memoryStore.writeMemory(memoryStore.createMemoryRecord({
    layer: "run",
    scope_key: makeRunScopeKey(run_id),
    record_key: `review:${review_id}`,
    title: `${role} review ${review_id}`,
    content: summary,
    tags: ["review", role],
    source_run_id: run_id,
    importance: "high",
  }));
}

export function writeEvidenceMemoryFromEvent(memoryStore: MemoryStore, run_id: string, event_type: string, content: string): void {
  memoryStore.writeEvidenceMemory(memoryStore.createMemoryRecord({
    layer: "evidence",
    scope_key: `evidence:${run_id}`,
    record_key: `event:${event_type}`,
    title: `Evidence: ${event_type}`,
    content,
    tags: ["evidence", event_type],
    source_run_id: run_id,
    importance: "high",
  }));
}
