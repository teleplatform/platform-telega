/**
 * TGR-6.99 — Per-trace memory pipeline debug snapshots
 */

import type { MemoryAttachment } from "./memory-context-attachment.js";
import type { MemoryRetrievalResult } from "./memory-retrieval-guard.js";
import type { MemoryWritebackResult, WritebackDeliveryStatus } from "./memory-writeback.js";

export interface MemoryDebugAttachRecord {
  user: MemoryAttachment["user"];
  surface: MemoryAttachment["surface"];
  project: MemoryAttachment["project"];
  task: MemoryAttachment["task"];
  canonical_keys: string[];
  evidence_refs: string[];
  short_context_count: number;
  working_context_count: number;
}

export interface MemoryDebugWritebackRecord {
  result: MemoryWritebackResult;
  response_id?: string;
  delivery_status?: WritebackDeliveryStatus;
}

export interface MemoryDebugSnapshot {
  trace_id: string;
  updated_at: string;
  attach?: MemoryDebugAttachRecord;
  retrieval?: MemoryRetrievalResult;
  writeback?: MemoryDebugWritebackRecord;
  queued_canon_candidate_ids?: string[];
}

const snapshots = new Map<string, MemoryDebugSnapshot>();

export function recordMemoryDebugAttach(
  traceId: string,
  attachment: MemoryAttachment,
): void {
  const existing = snapshots.get(traceId) ?? { trace_id: traceId, updated_at: new Date().toISOString() };
  existing.attach = {
    user: attachment.user,
    surface: attachment.surface,
    project: attachment.project,
    task: attachment.task,
    canonical_keys: [...attachment.canonical_keys],
    evidence_refs: [...attachment.evidence_refs],
    short_context_count: attachment.short_context.length,
    working_context_count: attachment.working_context.length,
  };
  existing.updated_at = new Date().toISOString();
  snapshots.set(traceId, existing);
}

export function recordMemoryDebugRetrieval(
  traceId: string,
  retrieval: MemoryRetrievalResult,
): void {
  const existing = snapshots.get(traceId) ?? { trace_id: traceId, updated_at: new Date().toISOString() };
  existing.retrieval = retrieval;
  existing.updated_at = new Date().toISOString();
  snapshots.set(traceId, existing);
}

export function recordMemoryDebugWriteback(
  traceId: string,
  writeback: MemoryWritebackResult,
  extras?: { response_id?: string; delivery_status?: WritebackDeliveryStatus },
): void {
  const existing = snapshots.get(traceId) ?? { trace_id: traceId, updated_at: new Date().toISOString() };
  existing.writeback = {
    result: writeback,
    response_id: extras?.response_id,
    delivery_status: extras?.delivery_status,
  };
  const ids = writeback.stored_items
    .filter((s) => s.startsWith("canon_candidate:") && !s.includes(":dup:"))
    .map((s) => s.replace("canon_candidate:", ""));
  if (ids.length) {
    existing.queued_canon_candidate_ids = ids;
  }
  existing.updated_at = new Date().toISOString();
  snapshots.set(traceId, existing);
}

export function getMemoryDebugSnapshot(traceId: string): MemoryDebugSnapshot | undefined {
  return snapshots.get(traceId);
}

export function clearMemoryDebugStore(): void {
  snapshots.clear();
}
