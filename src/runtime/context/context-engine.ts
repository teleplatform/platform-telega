import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import type { RuntimeContext, ContextBuildParams, ContextBlock } from "./context.types.js";
import { CONTEXT_LOADERS } from "./context-sources.js";
import { ContextPrioritizer } from "./context-prioritizer.js";
import { ContextBudget } from "./context-budget.js";
import { ContextSnapshot } from "./context-snapshot.js";

let contextCounter = 0;

function generateContextId(): string {
  return `ctx_${Date.now()}_${++contextCounter}`;
}

export class ContextEngine {
  readonly prioritizer: ContextPrioritizer;
  readonly budget: ContextBudget;
  readonly snapshot: ContextSnapshot;

  constructor() {
    this.prioritizer = new ContextPrioritizer();
    this.budget = new ContextBudget();
    this.snapshot = new ContextSnapshot();
  }

  async buildContext(params: ContextBuildParams): Promise<RuntimeContext> {
    const contextId = generateContextId();
    const now = new Date().toISOString();

    const context: RuntimeContext = {
      context_id: contextId,
      input_id: params.input_id,
      user_id: params.user_id,
      layers: {},
      budget: { max_tokens: 4096, used_tokens: 0, truncated: false },
      created_at: now,
    };

    await appendEvidenceRecord({
      evidence_id: hashTraceId(contextId, "context_build_started"),
      trace_id: params.input_id,
      job_id: "context",
      type: "context_build_started" as any,
      timestamp: now,
      payload: {
        context_id: contextId,
        input_id: params.input_id,
        user_id: params.user_id,
        intent: params.intent,
        route: params.route,
      },
    });

    const blocks: ContextBlock[] = [];

    for (const loader of CONTEXT_LOADERS) {
      const block = await loader.load(params);
      blocks.push(block);
    }

    const prioritized = this.prioritizer.prioritize(blocks, params.input_id);

    this.budget.apply(prioritized, context, params.input_id);

    await this.snapshot.capture(context);

    return context;
  }
}
