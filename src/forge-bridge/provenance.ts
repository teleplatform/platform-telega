// ─────────────────────────────────────────────────────────────
// FORGE BRIDGE HARDENING v1.0 — Provenance Builder
// ─────────────────────────────────────────────────────────────

import type { ForgeBundleProvenance } from "./types.js";

export function buildProvenance(input: {
  originSurface?: ForgeBundleProvenance["originSurface"];
  originTarget?: string;
  taskId?: string;
  actorId?: string;
  actorRole?: string;
  pipelineState?: string;
  executionState?: string;
  receiptRefs?: string[];
}): ForgeBundleProvenance {
  return {
    originSurface: input.originSurface,
    originTarget: input.originTarget,
    taskId: input.taskId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    pipelineState: input.pipelineState,
    executionState: input.executionState,
    receiptRefs: input.receiptRefs ?? [],
  };
}
