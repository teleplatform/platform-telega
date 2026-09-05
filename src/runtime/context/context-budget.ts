import type { PrioritizedBlock } from "./context-prioritizer.js";
import type { RuntimeContext } from "./context.types.js";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

const DEFAULT_MAX_TOKENS = 4096;
const MIN_PRIORITY_TO_INCLUDE = 10;

export class ContextBudget {
  apply(
    prioritized: PrioritizedBlock[],
    context: RuntimeContext,
    traceId: string,
    maxTokens: number = DEFAULT_MAX_TOKENS,
  ): RuntimeContext {
    let usedTokens = 0;
    let truncated = false;

    const included = prioritized.filter((p) => p.block.priority >= MIN_PRIORITY_TO_INCLUDE);

    for (const item of included) {
      const blockTokens = item.block.entries.reduce((s, e) => s + e.token_count, 0);
      if (usedTokens + blockTokens > maxTokens) {
        truncated = true;
        break;
      }

      const layerName = item.block.source;
      context.layers[layerName] = item.block;
      usedTokens += blockTokens;
    }

    context.budget = {
      max_tokens: maxTokens,
      used_tokens: usedTokens,
      truncated,
    };

    appendEvidenceRecord({
      evidence_id: hashTraceId(traceId, "context_budget_applied"),
      trace_id: traceId,
      job_id: "context",
      type: "context_budget_applied" as any,
      timestamp: new Date().toISOString(),
      payload: {
        max_tokens: maxTokens,
        used_tokens: usedTokens,
        truncated,
        layers_included: Object.keys(context.layers).length,
      },
    });

    return context;
  }
}
