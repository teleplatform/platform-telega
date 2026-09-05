/**
 * TGR-6.96 — Memory Retrieval Guard
 *
 * Safe memory selection before LLM — only selected_items enter the prompt.
 */

import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import type { MemoryAttachment, ProjectId } from "./memory-context-attachment.js";
import { getActiveTask } from "./memory-context-attachment.js";
import { excerptText } from "./memory-writeback.js";
import { getRecentTurns } from "./session-memory.js";
import { readMemoryRecord, queryMemoryRecords } from "./memory-store-adapter.js";
import { getPromotedCanonicalDecisions } from "./memory-canon-promotion.js";
import { isCanonicalDecisionKey, buildCanonicalDecisionKey } from "./memory-canon-keys.js";
import {
  isMemoryAllowedInPrompt,
  privacyBlockReason,
  redactMemorySecrets,
  sanitizeMemoryTextForPrompt,
} from "./memory-retention-policy.js";

export type RetrievedMemoryType = "session" | "working" | "canonical" | "evidence" | "task";

export interface MemoryRetrievalInput {
  memory_attachment: MemoryAttachment;
  user_message: string;
  max_items?: number;
  max_chars?: number;
}

export interface RetrievedMemoryItem {
  id: string;
  type: RetrievedMemoryType;
  project: ProjectId;
  relevance: number;
  freshness: number;
  confidence: number;
  text: string;
  ref?: string;
}

export interface DroppedMemoryItem {
  id: string;
  type: RetrievedMemoryType;
  project: ProjectId;
  reason: string;
}

export interface MemoryRetrievalResult {
  ok: boolean;
  selected_items: RetrievedMemoryItem[];
  dropped_items: DroppedMemoryItem[];
  total_chars: number;
  warnings: string[];
}

const DEFAULT_MAX_CHARS = 6000;
const DEFAULT_MAX_ITEMS = 24;
const MAX_ITEM_CHARS = 900;

const TYPE_PRIORITY: Record<RetrievedMemoryType, number> = {
  task: 100,
  working: 80,
  canonical: 70,
  session: 50,
  evidence: 40,
};

interface RawCandidate {
  id: string;
  type: RetrievedMemoryType;
  project: ProjectId;
  text: string;
  ref?: string;
  priority: number;
  relevance: number;
  freshness: number;
  confidence: number;
}

function resolveTraceId(attachment: MemoryAttachment): string {
  const ref = attachment.evidence_refs.find((r) => r.startsWith("trace:"));
  return ref?.slice("trace:".length) ?? `mrg_${Date.now().toString(36)}`;
}

function itemProjectFromValue(value: unknown, fallback: ProjectId): ProjectId {
  if (value && typeof value === "object" && "project" in value) {
    const p = String((value as { project: string }).project);
    if (p) return p as ProjectId;
  }
  return fallback;
}

function isCrossProjectAllowed(type: RetrievedMemoryType): boolean {
  return type === "session" || type === "evidence";
}

function buildTaskText(attachment: MemoryAttachment): string {
  const live = getActiveTask(attachment.user.user_id, attachment.surface.chat_id);
  const task = live ?? attachment.task;
  return [
    `task_id=${task.task_id}`,
    `intent=${task.intent}`,
    `status=${task.status}`,
    task.active_pack ? `pack=${task.active_pack}` : "",
    task.related_files?.length ? `files=${task.related_files.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

async function collectCandidates(attachment: MemoryAttachment): Promise<RawCandidate[]> {
  const currentProject = attachment.project.project;
  const confidence = attachment.project.confidence;
  const candidates: RawCandidate[] = [];
  const taskId = attachment.task.task_id;

  candidates.push({
    id: `task:${taskId}`,
    type: "task",
    project: currentProject,
    text: buildTaskText(attachment),
    priority: TYPE_PRIORITY.task,
    relevance: 0.98,
    freshness: 1,
    confidence,
  });

  try {
    const workingMem = await readMemoryRecord(`task.${taskId}.working`);
    if (workingMem?.data != null) {
      const wp = itemProjectFromValue(workingMem.data, currentProject);
      candidates.push({
        id: `working:${taskId}`,
        type: "working",
        project: wp,
        text:
          typeof workingMem.data === "string"
            ? workingMem.data
            : JSON.stringify(workingMem.data),
        ref: `memory:task.${taskId}.working`,
        priority: TYPE_PRIORITY.working,
        relevance: 0.92,
        freshness: 0.95,
        confidence,
      });
    }
  } catch {
    // empty store
  }

  for (const line of attachment.working_context) {
    if (!line.trim()) continue;
    candidates.push({
      id: `working_ctx:${candidates.length}`,
      type: "working",
      project: currentProject,
      text: line,
      priority: TYPE_PRIORITY.working - 5,
      relevance: 0.85,
      freshness: 0.9,
      confidence,
    });
  }

  if (currentProject !== "unknown") {
    try {
      const promoted = getPromotedCanonicalDecisions(currentProject);
      for (let i = 0; i < promoted.length; i++) {
        const { ref, text } = promoted[i];
        if (!text.trim()) continue;
        candidates.push({
          id: buildCanonicalDecisionKey(String(i)),
          type: "canonical",
          project: currentProject,
          text,
          ref,
          priority: TYPE_PRIORITY.canonical,
          relevance: 0.92,
          freshness: 0.9,
          confidence: Math.min(1, confidence + 0.15),
        });
      }
    } catch {
      // ignore
    }

    for (const key of attachment.canonical_keys) {
      candidates.push({
        id: `canon_key:${key}`,
        type: "canonical",
        project: currentProject,
        text: `canonical_key: ${key}`,
        ref: key,
        priority: TYPE_PRIORITY.canonical - 5,
        relevance: 0.8,
        freshness: 0.8,
        confidence,
      });
    }

    try {
      const canonCategory = await queryMemoryRecords({ category: "canonical" });
      for (const mem of canonCategory) {
        if (!mem.verified) continue;
        if (!mem.id.includes(currentProject) && !mem.id.includes(taskId)) continue;
        candidates.push({
          id: `canon_store:${mem.id}`,
          type: "canonical",
          project: currentProject,
          text: `${mem.id}: ${JSON.stringify(mem.data)}`,
          ref: mem.id,
          priority: TYPE_PRIORITY.canonical - 10,
          relevance: 0.75,
          freshness: 0.7,
          confidence: mem.verified ? 0.9 : 0.6,
        });
      }
    } catch {
      // ignore
    }
  }

  if (attachment.surface.chat_id) {
    try {
      const turns = getRecentTurns(attachment.surface.chat_id, 6);
      turns.forEach((t, i) => {
        candidates.push({
          id: `session:turn:${i}`,
          type: "session",
          project: currentProject,
          text: `${t.role}: ${t.content}`,
          ref: `session:${attachment.surface.chat_id}`,
          priority: TYPE_PRIORITY.session + (i / 100),
          relevance: 0.7 + i * 0.02,
          freshness: 0.6 + i * 0.05,
          confidence: 0.85,
        });
      });
    } catch {
      // ignore
    }
  }

  for (let i = 0; i < attachment.short_context.length; i++) {
    const line = attachment.short_context[i];
    if (!line.trim()) continue;
    candidates.push({
      id: `session:short:${i}`,
      type: "session",
      project: currentProject,
      text: line,
      priority: TYPE_PRIORITY.session - 5,
      relevance: 0.65,
      freshness: 0.55,
      confidence: 0.8,
    });
  }

  attachment.evidence_refs.forEach((ref, i) => {
    candidates.push({
      id: `evidence:${i}`,
      type: "evidence",
      project: currentProject,
      text: ref,
      ref,
      priority: TYPE_PRIORITY.evidence,
      relevance: 0.6,
      freshness: 0.5,
      confidence: 0.75,
    });
  });

  try {
    const prefs = await readMemoryRecord(`user.${attachment.user.user_id}.preferences`);
    if (prefs?.data != null) {
      candidates.push({
        id: `user:prefs`,
        type: "session",
        project: currentProject,
        text:
          typeof prefs.data === "string"
            ? prefs.data
            : JSON.stringify(prefs.data),
        ref: prefs.id,
        priority: TYPE_PRIORITY.session + 1,
        relevance: 0.72,
        freshness: 0.9,
        confidence: 0.9,
      });
    }
  } catch {
    // ignore
  }

  return candidates;
}

function normalizeItemText(text: string, ref?: string): { text: string; ref?: string } {
  if (text.length <= MAX_ITEM_CHARS) {
    return { text, ref };
  }
  return {
    text: excerptText(text, MAX_ITEM_CHARS),
    ref: ref ?? `excerpt:${text.length}`,
  };
}

function sortCandidates(a: RawCandidate, b: RawCandidate): number {
  if (b.priority !== a.priority) return b.priority - a.priority;
  if (b.relevance !== a.relevance) return b.relevance - a.relevance;
  return b.freshness - a.freshness;
}

/**
 * Select safe memory slice for LLM prompt (never throws).
 */
export async function retrieveMemoryForPrompt(
  input: MemoryRetrievalInput,
): Promise<MemoryRetrievalResult> {
  const warnings: string[] = [];
  const dropped_items: DroppedMemoryItem[] = [];
  const selected_items: RetrievedMemoryItem[] = [];

  const maxChars = input.max_chars ?? DEFAULT_MAX_CHARS;
  const maxItems = input.max_items ?? DEFAULT_MAX_ITEMS;
  const attachment = input.memory_attachment;
  const currentProject = attachment.project.project;
  const viewerUserId =
    attachment.user.telegram_id ?? attachment.user.user_id ?? attachment.user.web_session_id;

  let candidates: RawCandidate[] = [];
  try {
    candidates = await collectCandidates(attachment);
  } catch (e: unknown) {
    warnings.push(`collect: ${e instanceof Error ? e.message : String(e)}`);
    candidates = [];
  }

  if (candidates.length === 0) {
    const traceId = resolveTraceId(attachment);
    try {
      await appendEvidenceRecord({
        evidence_id: hashTraceId(traceId, "memory_retrieval_guard_done"),
        trace_id: traceId,
        job_id: "memory",
        task_id: attachment.task.task_id,
        type: "memory_retrieval_guard_done",
        timestamp: new Date().toISOString(),
        payload: {
          selected_count: 0,
          dropped_count: 0,
          total_chars: 0,
          project: currentProject,
          empty_store: true,
        },
      });
    } catch (e: unknown) {
      warnings.push(`evidence: ${e instanceof Error ? e.message : String(e)}`);
    }

    return { ok: true, selected_items: [], dropped_items: [], total_chars: 0, warnings };
  }

  candidates.sort(sortCandidates);

  let usedChars = 0;

  for (const c of candidates) {
    if (
      c.project !== currentProject &&
      currentProject !== "unknown" &&
      !isCrossProjectAllowed(c.type)
    ) {
      const reason = `project_mismatch: item=${c.project} current=${currentProject}`;
      dropped_items.push({
        id: c.id,
        type: c.type,
        project: c.project,
        reason,
      });
      console.log("[memory-retrieval-guard:dropped]", reason, c.id);
      continue;
    }

    if (
      currentProject === "unknown" &&
      c.type === "canonical" &&
      !c.id.startsWith("session:")
    ) {
      const reason = "unknown_project_skips_project_canon";
      dropped_items.push({ id: c.id, type: c.type, project: c.project, reason });
      console.log("[memory-retrieval-guard:dropped]", reason, c.id);
      continue;
    }

    const policyItem = {
      key: c.id,
      category: c.type,
      type: c.type,
      text: c.text,
      ref: c.ref,
      verified:
        c.type !== "canonical" || isCanonicalDecisionKey(c.id),
    };

    const privacyReason = privacyBlockReason(policyItem, viewerUserId);
    if (privacyReason) {
      dropped_items.push({
        id: c.id,
        type: c.type,
        project: c.project,
        reason: privacyReason,
      });
      console.log("[memory-retrieval-guard:dropped]", privacyReason, c.id);
      continue;
    }

    if (!isMemoryAllowedInPrompt(policyItem, viewerUserId)) {
      dropped_items.push({
        id: c.id,
        type: c.type,
        project: c.project,
        reason: "privacy_policy_blocked",
      });
      continue;
    }

    const promptSafe =
      c.type === "evidence"
        ? sanitizeMemoryTextForPrompt(policyItem)
        : {
            text: redactMemorySecrets(c.text),
            ref: c.ref,
          };

    const normalized = normalizeItemText(promptSafe.text, promptSafe.ref);
    const addLen = normalized.text.length + 1;

    if (selected_items.length >= maxItems) {
      dropped_items.push({
        id: c.id,
        type: c.type,
        project: c.project,
        reason: "max_items_exceeded",
      });
      continue;
    }

    if (usedChars + addLen > maxChars) {
      dropped_items.push({
        id: c.id,
        type: c.type,
        project: c.project,
        reason: "max_chars_exceeded",
      });
      continue;
    }

    selected_items.push({
      id: c.id,
      type: c.type,
      project: c.project,
      relevance: c.relevance,
      freshness: c.freshness,
      confidence: c.confidence,
      text: normalized.text,
      ref: normalized.ref,
    });
    usedChars += addLen;
  }

  const traceId = resolveTraceId(attachment);
  try {
    await appendEvidenceRecord({
      evidence_id: hashTraceId(traceId, "memory_retrieval_guard_done"),
      trace_id: traceId,
      job_id: "memory",
      task_id: attachment.task.task_id,
      type: "memory_retrieval_guard_done",
      timestamp: new Date().toISOString(),
      payload: {
        selected_count: selected_items.length,
        dropped_count: dropped_items.length,
        total_chars: usedChars,
        project: currentProject,
        types: selected_items.map((i) => i.type),
        drop_reasons: dropped_items.reduce<Record<string, number>>((acc, d) => {
          acc[d.reason] = (acc[d.reason] ?? 0) + 1;
          return acc;
        }, {}),
      },
    });
  } catch (e: unknown) {
    warnings.push(`evidence: ${e instanceof Error ? e.message : String(e)}`);
  }

  return {
    ok: true,
    selected_items,
    dropped_items,
    total_chars: usedChars,
    warnings,
  };
}

/** Format selected items for LLM prompt injection */
export function formatRetrievedMemoryForPrompt(items: RetrievedMemoryItem[]): string {
  if (!items.length) return "";
  return items
    .map((i) => `[${i.type}/${i.project}] ${i.text}${i.ref ? ` (${i.ref})` : ""}`)
    .join("\n");
}
