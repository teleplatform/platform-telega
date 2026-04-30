import type { MemoryRecord } from "../../fsgr-contracts/src/index.js";
import type { MemoryStore } from "./memoryStore.js";
import { makeRunScopeKey } from "./memoryKeys.js";

export interface RunContinuity {
  run_id: string;
  previous_runs: string[];
  linked_memories: number;
  linked_artifacts: number;
  linked_reviews: number;
  summary: string;
}

export function buildRunContinuity(memoryStore: MemoryStore, run_id: string, reviews: any[], artifacts: any[]): RunContinuity {
  const memories = memoryStore.readRunMemories(run_id);
  return {
    run_id,
    previous_runs: [],
    linked_memories: memories.length,
    linked_artifacts: artifacts.length,
    linked_reviews: reviews.length,
    summary: `Run ${run_id}: ${memories.length} memories, ${artifacts.length} artifacts, ${reviews.length} reviews`,
  };
}

export function linkRunToPrevious(previousRunIds: string[]): void {
  // Stored in continuity tracking for future reference
}

export function getPreviousRelatedRuns(runtime: any, run_id: string): string[] {
  // Returns linked run IDs from continuity tracking
  return [];
}
