// ─────────────────────────────────────────────────────────────
// FORGE EVIDENCE EXPORT TYPES v1
//
// Query, export formats, and persistence types.
// ─────────────────────────────────────────────────────────────

import type { ForgeInvocationEvidenceRecord } from "./forge-invocation-evidence.types.js";

export type ForgeEvidenceExportFormat = "json" | "jsonl" | "summary";

export interface ForgeEvidenceQuery {
  invocationId?: string;
  taskId?: string;
  userId?: string;
  role?: string;
  target?: string;
  kind?: string;
  status?: string;
  startedAfter?: string;
  startedBefore?: string;
  finishedAfter?: string;
  finishedBefore?: string;
  limit?: number;
  offset?: number;
  orderBy?: "startedAt" | "finishedAt" | "invocationId";
  order?: "asc" | "desc";
}

export interface ForgeEvidenceExportResult {
  ok: boolean;
  format: ForgeEvidenceExportFormat;
  count: number;
  output?: string;
  filePath?: string;
  error?: string;
}

export interface ForgeEvidenceStoreConfig {
  storeDir: string;
  fileName?: string;
  maxFileSize?: number;
  rotateDaily?: boolean;
}

export { ForgeInvocationEvidenceRecord };