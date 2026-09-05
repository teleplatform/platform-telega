/**
 * TGR-6.95 — Memory Writeback Core
 *
 * Message In → Memory Attached → LLM → Response Delivered → Memory Written Back
 */

import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import type { MemoryAttachment, TaskContext, TaskStatus } from "./memory-context-attachment.js";
import { updateActiveTaskAfterWriteback } from "./memory-context-attachment.js";
import { addTurn } from "./session-memory.js";
import { recordSessionSummary } from "./operational-memory.js";
import { writeMemoryRecord } from "./memory-store-adapter.js";
import { getCollapsedResponse } from "../../telegram/utils/telegram-collapse-store.js";
import {
  detectCanonCandidates,
  queueCanonCandidate,
} from "./memory-canon-promotion.js";
import { buildTaskCanonCandidateIndexKey } from "./memory-canon-keys.js";
import { applyMemoryRetentionPolicy, redactMemorySecrets } from "./memory-retention-policy.js";

export type WritebackDeliveryStatus = "delivered" | "failed" | "partial";

export interface MemoryWritebackInput {
  memory_attachment: MemoryAttachment;
  user_message: string;
  assistant_response: string;
  response_id: string;
  status: WritebackDeliveryStatus;
  evidence_refs?: string[];
}

export interface MemoryWritebackResult {
  ok: boolean;
  stored_items: string[];
  updated_task?: TaskContext;
  canonical_candidates: string[];
  evidence_event_id?: string;
  warnings: string[];
}

const MAX_USER_EXCERPT = 500;
const MAX_ASSISTANT_EXCERPT = 1200;
const MAX_STORED_SUMMARY = 400;
const MAX_FULL_TEXT_REF_CHARS = 200;

export function excerptText(text: string, maxLen: number): string {
  const raw = String(text ?? "").trim();
  if (raw.length <= maxLen) return raw;
  return `${raw.slice(0, maxLen)}… [${raw.length} chars total]`;
}

/** @deprecated use detectCanonCandidates from memory-canon-promotion */
export function extractCanonicalCandidates(response: string): string[] {
  return detectCanonCandidates(response);
}

function resolveTraceId(attachment: MemoryAttachment, responseId: string): string {
  const ref = attachment.evidence_refs.find((r) => r.startsWith("trace:"));
  if (ref) return ref.slice("trace:".length);
  return `wb_${responseId}`;
}

function buildResponseRef(responseId: string, assistantResponse: string): {
  excerpt: string;
  refs: string[];
} {
  const refs = [`response:${responseId}`];
  const collapsed = getCollapsedResponse(responseId);
  if (collapsed?.full_text) {
    const len = collapsed.full_text.length;
    refs.push(`collapse:${responseId}`, `full_text_len:${len}`);
    return {
      excerpt: excerptText(collapsed.preview_text || assistantResponse, MAX_ASSISTANT_EXCERPT),
      refs,
    };
  }
  return {
    excerpt: excerptText(assistantResponse, MAX_ASSISTANT_EXCERPT),
    refs,
  };
}

function inferTaskStatus(
  deliveryStatus: WritebackDeliveryStatus,
  canonicalCandidates: string[],
): TaskStatus {
  if (deliveryStatus === "failed") return "blocked";
  if (canonicalCandidates.some((c) => /\bDONE\b|COMPLETE|STABLE/i.test(c))) {
    return "done";
  }
  if (deliveryStatus === "partial") return "open";
  return "open";
}

/**
 * Write back memory after response generation/delivery (never throws).
 */
export async function writebackMemory(
  input: MemoryWritebackInput,
): Promise<MemoryWritebackResult> {
  const warnings: string[] = [];
  const stored_items: string[] = [];
  const attachment = input.memory_attachment;
  const chatId = attachment.surface.chat_id;
  const taskId = attachment.task.task_id;
  const traceId = resolveTraceId(attachment, input.response_id);

  let updated_task: TaskContext | undefined;
  const canonical_candidates = detectCanonCandidates(input.assistant_response);
  const queued_candidate_ids: string[] = [];

  const userPolicy = applyMemoryRetentionPolicy({
    text: input.user_message,
    category: "session",
    type: "session",
    task_status: attachment.task.status,
  });
  const assistantPolicy = applyMemoryRetentionPolicy({
    text: input.assistant_response,
    category: "session",
    type: "session",
    task_status: attachment.task.status,
  });

  const userExcerpt = excerptText(userPolicy.redacted_text, MAX_USER_EXCERPT);
  const { excerpt: assistantExcerpt, refs: responseRefs } = buildResponseRef(
    input.response_id,
    assistantPolicy.redacted_text,
  );

  try {
    if (chatId) {
      addTurn(chatId, "user", userExcerpt);
      addTurn(chatId, "assistant", assistantExcerpt);
      stored_items.push("session:user_turn", "session:assistant_turn");

      const summary = excerptText(
        `project=${attachment.project.project} task=${taskId} | user: ${userExcerpt.slice(0, 120)} | assistant: ${assistantExcerpt.slice(0, 180)}`,
        MAX_STORED_SUMMARY,
      );
      recordSessionSummary(chatId, summary);
      stored_items.push("session:summary");
    }
  } catch (e: unknown) {
    warnings.push(`session-memory: ${e instanceof Error ? e.message : String(e)}`);
  }

  const workingPayload = {
    task_id: taskId,
    project: attachment.project.project,
    intent: attachment.task.intent,
    last_user: userExcerpt,
    last_assistant: assistantExcerpt,
    response_id: input.response_id,
    response_refs: responseRefs,
    full_text_ref: responseRefs.includes(`collapse:${input.response_id}`)
      ? `collapse:${input.response_id} (not stored inline)`
      : excerptText(redactMemorySecrets(input.assistant_response), MAX_FULL_TEXT_REF_CHARS),
    delivery_status: input.status,
    updated_at: new Date().toISOString(),
  };

  const workingPolicy = applyMemoryRetentionPolicy({
    key: `task.${taskId}.working`,
    category: "task_working",
    type: "working",
    value: workingPayload,
    task_status: attachment.task.status,
  });

  try {
    if (!workingPolicy.allow_store) {
      warnings.push(workingPolicy.reason ?? "working_context_blocked_by_policy");
    } else {
      await writeMemoryRecord({
        id: `task.${taskId}.working`,
        created_at: Date.now(),
        updated_at: Date.now(),
        type: "working",
        category: "task_working",
        project: attachment.project.project,
        task_id: taskId,
        user_id: attachment.user.user_id,
        privacy: workingPolicy.privacy,
        retention: workingPolicy.retention,
        expires_at: workingPolicy.expires_at,
        text: JSON.stringify(workingPolicy.sanitized_value ?? workingPayload),
        data: workingPolicy.sanitized_value ?? workingPayload,
        verified: true,
      });
      stored_items.push(`task.${taskId}.working`);
    }
  } catch (e: unknown) {
    warnings.push(`task working context: ${e instanceof Error ? e.message : String(e)}`);
  }

  for (const line of canonical_candidates) {
    try {
      const queued = await queueCanonCandidate({
        text: line,
        project: attachment.project.project,
        task_id: taskId,
        user_id: attachment.user.user_id,
        response_id: input.response_id,
        trace_id: traceId,
      });
      if (queued.candidate_id && !queued.duplicate) {
        queued_candidate_ids.push(queued.candidate_id);
        stored_items.push(`canon_candidate:${queued.candidate_id}`);
      } else if (queued.duplicate && queued.candidate_id) {
        stored_items.push(`canon_candidate:dup:${queued.candidate_id}`);
      }
    } catch (e: unknown) {
      warnings.push(`canon queue: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (queued_candidate_ids.length > 0) {
    try {
      await writeMemoryRecord({
        id: buildTaskCanonCandidateIndexKey(taskId),
        created_at: Date.now(),
        updated_at: Date.now(),
        type: "canon_candidate_index",
        category: "canon_candidate_index",
        project: attachment.project.project,
        task_id: taskId,
        user_id: attachment.user.user_id,
        privacy: "internal",
        retention: "working",
        text: queued_candidate_ids.join(","),
        data: queued_candidate_ids,
        verified: false,
      });
      stored_items.push(`task.${taskId}.canon_candidate_ids`);
    } catch (e: unknown) {
      warnings.push(`canon index: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const nextStatus = inferTaskStatus(input.status, canonical_candidates);
  try {
    updated_task = updateActiveTaskAfterWriteback(
      attachment.user.user_id,
      chatId,
      {
        status: nextStatus,
        related_files: attachment.task.related_files,
      },
    );
    if (updated_task) {
      stored_items.push("task:status_update");
    }
  } catch (e: unknown) {
    warnings.push(`task update: ${e instanceof Error ? e.message : String(e)}`);
  }

  const evidenceType =
    input.status === "delivered" ? "memory_writeback_done" : "memory_writeback_partial";

  let evidence_event_id: string | undefined;
  try {
    evidence_event_id = hashTraceId(traceId, evidenceType);
    await appendEvidenceRecord({
      evidence_id: evidence_event_id,
      trace_id: traceId,
      job_id: "memory",
      task_id: taskId,
      type: evidenceType,
      timestamp: new Date().toISOString(),
      payload: {
        response_id: input.response_id,
        delivery_status: input.status,
        project: attachment.project.project,
        stored_items,
        canonical_candidates_count: canonical_candidates.length,
        warnings_count: warnings.length,
        collapse_linked: responseRefs.some((r) => r.startsWith("collapse:")),
        evidence_refs: input.evidence_refs,
      },
    });
    stored_items.push(`evidence:${evidenceType}`);
  } catch (e: unknown) {
    warnings.push(`evidence: ${e instanceof Error ? e.message : String(e)}`);
  }

  const ok =
    input.status === "delivered"
      ? stored_items.length > 0 && warnings.length === 0
      : stored_items.length > 0 || warnings.length > 0;

  return {
    ok,
    stored_items,
    updated_task,
    canonical_candidates,
    evidence_event_id,
    warnings,
  };
}
