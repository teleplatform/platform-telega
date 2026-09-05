import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import type { RuntimeContext } from "./context.types.js";

export class ContextSnapshot {
  async capture(context: RuntimeContext): Promise<void> {
    const layerSummaries: Record<string, { entry_count: number; tokens: number }> = {};

    for (const [name, block] of Object.entries(context.layers)) {
      if (block) {
        layerSummaries[name] = {
          entry_count: block.entries.length,
          tokens: block.token_count,
        };
      }
    }

    await appendEvidenceRecord({
      evidence_id: hashTraceId(context.context_id, "context_snapshot_created"),
      trace_id: context.input_id,
      job_id: "context",
      type: "context_snapshot_created" as any,
      timestamp: new Date().toISOString(),
      payload: {
        context_id: context.context_id,
        input_id: context.input_id,
        run_id: context.run_id,
        budget: context.budget,
        layers: layerSummaries,
      },
    });
  }
}
