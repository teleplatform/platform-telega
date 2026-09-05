/**
 * TGR-6.98 — Memory Canon Promotion Gate
 *
 * Memory ≠ Canon. Candidates require review → accept/reject → promote.
 */

import crypto from "node:crypto";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import type { ProjectId } from "./memory-context-attachment.js";
import { setMemory, getMemory, getMemoriesByCategory } from "./runtime-memory-store.js";
import {
  buildCanonicalDecisionKey,
  CANONICAL_DECISION_CATEGORY,
} from "./memory-canon-keys.js";

function excerptShort(text: string, maxLen: number): string {
  const raw = String(text ?? "").trim();
  if (raw.length <= maxLen) return raw;
  return `${raw.slice(0, maxLen)}…`;
}

export type CanonCandidateStatus = "review_pending" | "accepted" | "rejected" | "promoted";

export interface CanonCandidate {
  candidate_id: string;
  status: CanonCandidateStatus;
  text: string;
  signal: string;
  project: ProjectId;
  task_id?: string;
  user_id?: string;
  response_id?: string;
  trace_id?: string;
  fingerprint: string;
  created_at: string;
  reviewed_at?: string;
  rejection_reason?: string;
  canonical_decision_ref?: string;
  /** Stub ref for future Mission Control export — not wired yet */
  mission_control_ref?: string;
}

export interface CanonPromotionDecision {
  decision: "accepted" | "rejected";
  reviewer_id?: string;
  reason?: string;
}

export interface CanonPromotionResult {
  ok: boolean;
  candidate_id?: string;
  candidate?: CanonCandidate;
  duplicate?: boolean;
  canonical_decision_ref?: string;
  mission_control_ref?: string;
  evidence_event_id?: string;
  error?: string;
}

const CANONICAL_SIGNAL =
  /\b(DONE|LOCKED|COMPLETE|COMPLETED|STABLE|BASELINE)\b|status:\s*(done|complete|locked|pass)|TGR-\d+(?:\.\d+)?\s*—\s*DONE|✅/i;

const candidateStore = new Map<string, CanonCandidate>();
const fingerprintIndex = new Map<string, string>();

function makeCandidateId(): string {
  return crypto.randomBytes(5).toString("hex");
}

function fingerprintFor(input: {
  text: string;
  project: ProjectId;
  task_id?: string;
}): string {
  const normalized = String(input.text).replace(/\s+/g, " ").trim().toLowerCase();
  const raw = `${input.project}|${input.task_id ?? ""}|${normalized}`;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

function detectSignal(text: string): string {
  const match = text.match(
    /\b(DONE|LOCKED|STABLE|BASELINE|COMPLETE|COMPLETED)\b|TGR-\d+(?:\.\d+)?\s*—\s*DONE/i,
  );
  return match?.[0] ?? "canonical_signal";
}

export function buildMissionControlCanonRef(candidateId: string): string {
  return `mission_control://canon/review/${candidateId}`;
}

/**
 * Detect canon-worthy lines in assistant text (does not write canon).
 */
export function detectCanonCandidates(text: string): string[] {
  const candidates: string[] = [];
  const body = String(text ?? "");

  if (!CANONICAL_SIGNAL.test(body)) {
    return candidates;
  }

  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (CANONICAL_SIGNAL.test(line) && line.length <= 280) {
      candidates.push(line);
    }
    if (candidates.length >= 5) break;
  }

  if (candidates.length === 0) {
    candidates.push(`canonical_signal: ${excerptShort(body.replace(/\s+/g, " "), 200)}`);
  }

  return candidates;
}

function persistCandidate(record: CanonCandidate): void {
  candidateStore.set(record.candidate_id, record);
  fingerprintIndex.set(record.fingerprint, record.candidate_id);
  try {
    setMemory(`canon.candidate.${record.candidate_id}`, record, "canon_candidate", false);
  } catch {
    // non-fatal
  }
}

export function getCanonCandidate(candidateId: string): CanonCandidate | undefined {
  return (
    candidateStore.get(candidateId) ??
    (getMemory(`canon.candidate.${candidateId}`)?.value as CanonCandidate | undefined)
  );
}

export function listCanonCandidatesByStatus(
  status: CanonCandidateStatus,
): CanonCandidate[] {
  return [...candidateStore.values()].filter((c) => c.status === status);
}

export function listCanonCandidatesByTrace(traceId: string): CanonCandidate[] {
  return [...candidateStore.values()].filter((c) => c.trace_id === traceId);
}

async function emitCanonEvidence(
  type:
    | "canon_candidate_queued"
    | "canon_candidate_accepted"
    | "canon_candidate_rejected"
    | "canon_candidate_promoted",
  candidate: CanonCandidate,
  extra?: Record<string, unknown>,
): Promise<string> {
  const traceId = candidate.trace_id ?? `canon_${candidate.candidate_id}`;
  const evidence_id = hashTraceId(traceId, `${type}_${candidate.candidate_id}`);
  await appendEvidenceRecord({
    evidence_id,
    trace_id: traceId,
    job_id: "memory",
    task_id: candidate.task_id,
    type,
    timestamp: new Date().toISOString(),
    payload: {
      candidate_id: candidate.candidate_id,
      project: candidate.project,
      status: candidate.status,
      signal: candidate.signal,
      ...extra,
    },
  });
  return evidence_id;
}

/**
 * Queue candidate for review (never writes canon).
 */
export async function queueCanonCandidate(input: {
  text: string;
  project: ProjectId;
  task_id?: string;
  user_id?: string;
  response_id?: string;
  trace_id?: string;
  signal?: string;
}): Promise<CanonPromotionResult> {
  const text = String(input.text ?? "").trim();
  if (!text) {
    return { ok: false, error: "empty candidate text" };
  }

  const fingerprint = fingerprintFor({
    text,
    project: input.project,
    task_id: input.task_id,
  });

  const existingId = fingerprintIndex.get(fingerprint);
  if (existingId) {
    const existing = getCanonCandidate(existingId);
    if (existing && existing.status === "review_pending") {
      return { ok: true, candidate_id: existingId, candidate: existing, duplicate: true };
    }
    if (existing && (existing.status === "accepted" || existing.status === "promoted")) {
      return {
        ok: true,
        candidate_id: existingId,
        candidate: existing,
        duplicate: true,
        canonical_decision_ref: existing.canonical_decision_ref,
      };
    }
  }

  const candidate_id = makeCandidateId();
  const mission_control_ref = buildMissionControlCanonRef(candidate_id);
  const candidate: CanonCandidate = {
    candidate_id,
    status: "review_pending",
    text,
    signal: input.signal ?? detectSignal(text),
    project: input.project,
    task_id: input.task_id,
    user_id: input.user_id,
    response_id: input.response_id,
    trace_id: input.trace_id,
    fingerprint,
    created_at: new Date().toISOString(),
    mission_control_ref,
  };

  persistCandidate(candidate);

  try {
    const evidence_event_id = await emitCanonEvidence("canon_candidate_queued", candidate);
    return {
      ok: true,
      candidate_id,
      candidate,
      duplicate: false,
      mission_control_ref,
      evidence_event_id,
    };
  } catch (e: unknown) {
    return {
      ok: true,
      candidate_id,
      candidate,
      mission_control_ref,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Accept or reject a queued candidate (still not canon until promote).
 */
export async function reviewCanonCandidate(
  candidateId: string,
  decision: CanonPromotionDecision,
): Promise<CanonPromotionResult> {
  const candidate = getCanonCandidate(candidateId);
  if (!candidate) {
    return { ok: false, error: "candidate not found" };
  }

  if (candidate.status !== "review_pending") {
    return { ok: false, error: `invalid status for review: ${candidate.status}` };
  }

  const reviewed_at = new Date().toISOString();

  if (decision.decision === "rejected") {
    candidate.status = "rejected";
    candidate.reviewed_at = reviewed_at;
    candidate.rejection_reason = decision.reason ?? "rejected_by_reviewer";
    persistCandidate(candidate);

    const evidence_event_id = await emitCanonEvidence("canon_candidate_rejected", candidate, {
      reviewer_id: decision.reviewer_id,
      reason: candidate.rejection_reason,
    });

    return { ok: true, candidate_id: candidateId, candidate, evidence_event_id };
  }

  candidate.status = "accepted";
  candidate.reviewed_at = reviewed_at;
  candidate.canonical_decision_ref = buildCanonicalDecisionKey(candidateId);
  persistCandidate(candidate);

  const evidence_event_id = await emitCanonEvidence("canon_candidate_accepted", candidate, {
    reviewer_id: decision.reviewer_id,
    canonical_decision_ref: candidate.canonical_decision_ref,
  });

  return {
    ok: true,
    candidate_id: candidateId,
    candidate,
    canonical_decision_ref: candidate.canonical_decision_ref,
    evidence_event_id,
  };
}

/**
 * Promote accepted candidate into verified canonical decision store.
 */
export async function promoteAcceptedCandidate(
  candidateId: string,
): Promise<CanonPromotionResult> {
  const candidate = getCanonCandidate(candidateId);
  if (!candidate) {
    return { ok: false, error: "candidate not found" };
  }

  if (candidate.status === "promoted") {
    return {
      ok: true,
      candidate_id: candidateId,
      candidate,
      canonical_decision_ref: candidate.canonical_decision_ref,
      duplicate: true,
    };
  }

  if (candidate.status !== "accepted") {
    return { ok: false, error: `promotion requires accepted status, got ${candidate.status}` };
  }

  const ref = candidate.canonical_decision_ref ?? buildCanonicalDecisionKey(candidateId);
  const decisionPayload = {
    candidate_id: candidateId,
    text: candidate.text,
    signal: candidate.signal,
    project: candidate.project,
    task_id: candidate.task_id,
    promoted_at: new Date().toISOString(),
    source: "memory_canon_promotion_gate",
  };

  try {
    setMemory(ref, decisionPayload, CANONICAL_DECISION_CATEGORY, true);
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  candidate.status = "promoted";
  candidate.canonical_decision_ref = ref;
  persistCandidate(candidate);

  const evidence_event_id = await emitCanonEvidence("canon_candidate_promoted", candidate, {
    canonical_decision_ref: ref,
  });

  return {
    ok: true,
    candidate_id: candidateId,
    candidate,
    canonical_decision_ref: ref,
    evidence_event_id,
  };
}

/** Load promoted canonical decisions for retrieval */
export function getPromotedCanonicalDecisions(project?: ProjectId): Array<{
  ref: string;
  text: string;
}> {
  const out: Array<{ ref: string; text: string }> = [];
  try {
    const items = getMemoriesByCategory(CANONICAL_DECISION_CATEGORY);
    for (const mem of items) {
      if (!mem.verified) continue;
      const val = mem.value as { text?: string; project?: string } | string;
      const text =
        typeof val === "string" ? val : String(val?.text ?? JSON.stringify(val));
      const memProject =
        typeof val === "object" && val && "project" in val
          ? String((val as { project?: string }).project)
          : undefined;
      if (project && memProject && memProject !== project) continue;
      out.push({ ref: mem.key, text });
    }
  } catch {
    // empty store
  }
  return out;
}

/** Test / ops */
export function clearCanonCandidateStore(): void {
  candidateStore.clear();
  fingerprintIndex.clear();
}
