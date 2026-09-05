import type { ContextBlock } from "./context.types.js";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export interface PrioritizedBlock {
  block: ContextBlock;
  score: number;
}

export class ContextPrioritizer {
  prioritize(blocks: ContextBlock[], traceId: string): PrioritizedBlock[] {
    const scored: PrioritizedBlock[] = blocks.map((block) => {
      const baseScore = block.priority;
      const entryScore = Math.min(block.entries.length * 5, 20);
      const score = baseScore + entryScore;

      return { block, score };
    });

    scored.sort((a, b) => b.score - a.score);

    appendEvidenceRecord({
      evidence_id: hashTraceId(traceId, "context_prioritized"),
      trace_id: traceId,
      job_id: "context",
      type: "context_prioritized" as any,
      timestamp: new Date().toISOString(),
      payload: {
        block_count: scored.length,
        top_source: scored[0]?.block.source ?? "none",
        top_score: scored[0]?.score ?? 0,
      },
    });

    return scored;
  }
}
