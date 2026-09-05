/**
 * TGR-6.99 — Memory Surface Debug Panel
 */

import { isAnyCreator } from "../../core/auth/runtime-access.js";
import { getCollapsedResponse } from "../../telegram/utils/telegram-collapse-store.js";
import { getMemory } from "./runtime-memory-store.js";
import {
  getCanonCandidate,
  getPromotedCanonicalDecisions,
  listCanonCandidatesByTrace,
} from "./memory-canon-promotion.js";
import { getMemoryDebugSnapshot } from "./memory-debug-store.js";
import type { DroppedMemoryItem, RetrievedMemoryItem } from "./memory-retrieval-guard.js";
import type { CanonCandidate } from "./memory-canon-promotion.js";
import { redactMemorySecrets } from "./memory-retention-policy.js";

/** @deprecated use redactMemorySecrets — debug panel is always redacted */
export function redactSecrets(text: string): string {
  return redactMemorySecrets(text);
}

function excerptForDebug(text: string, maxLen = 320): string {
  const safe = redactMemorySecrets(text);
  if (safe.length <= maxLen) return safe;
  return `${safe.slice(0, maxLen)}… [len=${text.length}]`;
}

function sanitizeRetrievedItem(item: RetrievedMemoryItem): RetrievedMemoryItem {
  return {
    ...item,
    text: excerptForDebug(item.text),
    ref: item.ref?.includes("full_text") ? item.ref : item.ref,
  };
}

function sanitizeDroppedItem(item: DroppedMemoryItem): DroppedMemoryItem {
  return {
    ...item,
    reason: redactSecrets(item.reason),
  };
}

function collapseRef(responseId?: string): { ref?: string; len?: number } | undefined {
  if (!responseId) return undefined;
  const collapsed = getCollapsedResponse(responseId);
  if (!collapsed?.full_text) return { ref: `response:${responseId}` };
  return {
    ref: `collapse:${responseId}`,
    len: collapsed.full_text.length,
  };
}

function formatCanonCandidate(c: CanonCandidate): Record<string, unknown> {
  return {
    candidate_id: c.candidate_id,
    status: c.status,
    unverified: c.status !== "promoted",
    signal: c.signal,
    text: excerptForDebug(c.text),
    project: c.project,
    mission_control_ref: c.mission_control_ref,
    canonical_decision_ref: c.canonical_decision_ref,
    rejection_reason: c.rejection_reason
      ? excerptForDebug(c.rejection_reason, 120)
      : undefined,
  };
}

export interface MemoryDebugPanelResponse {
  trace_id: string;
  found: boolean;
  user?: Record<string, unknown>;
  surface?: Record<string, unknown>;
  project?: {
    project: string;
    confidence: number;
    reason: string;
    unknown: boolean;
  };
  task?: Record<string, unknown>;
  retrieval?: {
    selected_items: RetrievedMemoryItem[];
    dropped_items: DroppedMemoryItem[];
    total_chars: number;
    warnings: string[];
  };
  writeback?: {
    stored_items: string[];
    updated_task?: Record<string, unknown>;
    canonical_candidates: string[];
    queued_candidate_ids: string[];
    evidence_event_id?: string;
    response_id?: string;
    delivery_status?: string;
    collapse?: { ref?: string; len?: number };
    warnings: string[];
  };
  canon_promotion?: {
    pending_candidates: Array<Record<string, unknown>>;
    promoted_refs: Array<{ ref: string; text: string; verified: boolean }>;
  };
  evidence_refs: string[];
  message?: string;
}

export function assertMemoryDebugAccess(userId?: string | number | null): boolean {
  return isAnyCreator(userId);
}

/**
 * Build debug panel for a trace (safe for empty / missing data).
 */
function buildCanonPromotionSection(projectId?: string, traceId?: string, queuedIds?: string[]) {
  const traceCandidates = traceId ? listCanonCandidatesByTrace(traceId) : [];
  const pending_candidates = traceCandidates
    .filter((c) => c.status === "review_pending" || c.status === "accepted")
    .map(formatCanonCandidate);

  for (const id of queuedIds ?? []) {
    const c = getCanonCandidate(id);
    if (c && !pending_candidates.some((p) => p.candidate_id === id)) {
      pending_candidates.push(formatCanonCandidate(c));
    }
  }

  const promoted_refs = projectId
    ? getPromotedCanonicalDecisions(projectId as any).map((p) => ({
        ref: p.ref,
        text: excerptForDebug(p.text, 200),
        verified: true,
      }))
    : [];

  return { pending_candidates, promoted_refs };
}

export function buildMemoryDebugPanel(traceId: string): MemoryDebugPanelResponse {
  const snapshot = getMemoryDebugSnapshot(traceId);
  const canonOnly = buildCanonPromotionSection(undefined, traceId, snapshot?.queued_canon_candidate_ids);

  if (!snapshot) {
    const hasCanon = canonOnly.pending_candidates.length > 0;
    return {
      trace_id: traceId,
      found: hasCanon,
      evidence_refs: [],
      canon_promotion: canonOnly,
      message: hasCanon
        ? "partial snapshot: canon promotion only"
        : "no memory debug snapshot for this trace",
      retrieval: {
        selected_items: [],
        dropped_items: [],
        total_chars: 0,
        warnings: ["retrieval not recorded"],
      },
    };
  }

  const attach = snapshot.attach;
  const project = attach?.project;

  const retrieval = snapshot.retrieval
    ? {
        selected_items: (snapshot.retrieval.selected_items ?? []).map(sanitizeRetrievedItem),
        dropped_items: (snapshot.retrieval.dropped_items ?? []).map(sanitizeDroppedItem),
        total_chars: snapshot.retrieval.total_chars ?? 0,
        warnings: snapshot.retrieval.warnings ?? [],
      }
    : {
        selected_items: [],
        dropped_items: [],
        total_chars: 0,
        warnings: ["retrieval not recorded"],
      };

  const wb = snapshot.writeback?.result;
  const writeback = wb
    ? {
        stored_items: wb.stored_items ?? [],
        updated_task: wb.updated_task
          ? {
              task_id: wb.updated_task.task_id,
              intent: wb.updated_task.intent,
              status: wb.updated_task.status,
              active_pack: wb.updated_task.active_pack,
            }
          : undefined,
        canonical_candidates: (wb.canonical_candidates ?? []).map((c) => excerptForDebug(c, 200)),
        queued_candidate_ids: snapshot.queued_canon_candidate_ids ?? [],
        evidence_event_id: wb.evidence_event_id,
        response_id: snapshot.writeback?.response_id,
        delivery_status: snapshot.writeback?.delivery_status,
        collapse: collapseRef(snapshot.writeback?.response_id),
        warnings: wb.warnings ?? [],
      }
    : undefined;

  const canon_promotion = buildCanonPromotionSection(
    project?.project,
    traceId,
    snapshot.queued_canon_candidate_ids,
  );

  const workingMem = attach?.task?.task_id
    ? getMemory(`task.${attach.task.task_id}.working`)
    : undefined;
  const workingVal = workingMem?.value as Record<string, unknown> | undefined;
  const workingSafe =
    workingVal && typeof workingVal === "object"
      ? {
          ...workingVal,
          last_user: workingVal.last_user
            ? excerptForDebug(String(workingVal.last_user))
            : undefined,
          last_assistant: workingVal.last_assistant
            ? excerptForDebug(String(workingVal.last_assistant))
            : undefined,
          full_text_ref: workingVal.full_text_ref
            ? String(workingVal.full_text_ref)
            : undefined,
        }
      : undefined;

  return {
    trace_id: traceId,
    found: true,
    user: attach?.user
      ? {
          user_id: attach.user.user_id,
          telegram_id: attach.user.telegram_id,
          role: attach.user.role,
          display_name: attach.user.display_name,
        }
      : undefined,
    surface: attach?.surface as any,
    project: project
      ? {
          project: project.project,
          confidence: project.confidence,
          reason: redactSecrets(project.reason),
          unknown: project.project === "unknown",
        }
      : undefined,
    task: attach?.task
      ? {
          ...attach.task,
          working_context_preview: workingSafe,
        }
      : undefined,
    retrieval,
    writeback,
    canon_promotion,
    evidence_refs: attach?.evidence_refs ?? [],
  };
}
