/**
 * TGR-7.04 — Memory Canon Key Helpers
 *
 * Canon: Canon refs are typed keys, not raw strings.
 * Never build "canonical_decision." + id by hand.
 */

// ── Constants ──────────────────────────────────────────────────────────

export const CANONICAL_DECISION_CATEGORY = "canonical_decision";
export const CANON_CANDIDATE_CATEGORY = "canonical_candidate";

// ── Key builders ───────────────────────────────────────────────────────

/**
 * Build memory key for a promoted canonical decision.
 * Format: canonical_decision.{candidateId}
 */
export function buildCanonicalDecisionKey(candidateId: string): string {
  return `canonical_decision.${candidateId}`;
}

/**
 * Build memory key for a canon candidate (before promotion).
 * Format: canonical_candidate.{candidateId}
 */
export function buildCanonCandidateKey(candidateId: string): string {
  return `canonical_candidate.${candidateId}`;
}

/**
 * Build memory key for the task-level index of canon candidate IDs.
 * Format: task.{taskId}.canon_candidate_ids
 */
export function buildTaskCanonCandidateIndexKey(taskId: string): string {
  return `task.${taskId}.canon_candidate_ids`;
}

/**
 * Build memory key for a task's canonical_candidates list (unverified).
 * Format: task.{taskId}.canonical_candidates
 */
export function buildTaskCanonicalCandidatesKey(taskId: string): string {
  return `task.${taskId}.canonical_candidates`;
}

// ── Parsers ────────────────────────────────────────────────────────────

export interface CanonicalDecisionRef {
  type: "canonical_decision";
  candidateId: string;
}

export interface CanonCandidateRef {
  type: "canonical_candidate";
  candidateId: string;
}

export interface TaskCanonCandidateIndexRef {
  type: "task_canon_candidate_index";
  taskId: string;
}

export interface TaskCanonicalCandidatesRef {
  type: "task_canonical_candidates";
  taskId: string;
}

export type ParsedCanonKey =
  | CanonicalDecisionRef
  | CanonCandidateRef
  | TaskCanonCandidateIndexRef
  | TaskCanonicalCandidatesRef;

const CANON_DECISION_PREFIX = "canonical_decision.";
const CANON_CANDIDATE_PREFIX = "canonical_candidate.";
const TASK_CANON_IDX_PREFIX = "canon_candidate_ids";
const TASK_CANON_CANDS_PREFIX = "canonical_candidates";

/**
 * Parse a canon key into its structured form.
 * Returns null if the key is not a recognized canon key format.
 */
export function parseCanonKey(key: string): ParsedCanonKey | null {
  if (key.startsWith(CANON_DECISION_PREFIX)) {
    const candidateId = key.slice(CANON_DECISION_PREFIX.length);
    if (!candidateId) return null;
    return { type: "canonical_decision", candidateId };
  }

  if (key.startsWith(CANON_CANDIDATE_PREFIX)) {
    const candidateId = key.slice(CANON_CANDIDATE_PREFIX.length);
    if (!candidateId) return null;
    return { type: "canonical_candidate", candidateId };
  }

  const taskMatch = key.match(/^task\.(.+?)\.(.+)$/);
  if (taskMatch) {
    const taskId = taskMatch[1];
    const suffix = taskMatch[2];
    if (suffix === TASK_CANON_IDX_PREFIX) {
      return { type: "task_canon_candidate_index", taskId };
    }
    if (suffix === TASK_CANON_CANDS_PREFIX) {
      return { type: "task_canonical_candidates", taskId };
    }
  }

  return null;
}

export function parseCanonicalDecisionKey(key: string): CanonicalDecisionRef | null {
  const parsed = parseCanonKey(key);
  return parsed?.type === "canonical_decision" ? parsed : null;
}

export function parseCanonCandidateKey(key: string): CanonCandidateRef | null {
  const parsed = parseCanonKey(key);
  return parsed?.type === "canonical_candidate" ? parsed : null;
}

export function parseTaskCanonCandidateIndexKey(key: string): TaskCanonCandidateIndexRef | null {
  const parsed = parseCanonKey(key);
  return parsed?.type === "task_canon_candidate_index" ? parsed : null;
}

// ── Key type checks ────────────────────────────────────────────────────

export function isCanonicalDecisionKey(key: string): boolean {
  return key.startsWith(CANON_DECISION_PREFIX);
}

export function isCanonCandidateKey(key: string): boolean {
  return key.startsWith(CANON_CANDIDATE_PREFIX);
}

export function isTaskCanonKey(key: string): boolean {
  return key.startsWith("task.");
}
