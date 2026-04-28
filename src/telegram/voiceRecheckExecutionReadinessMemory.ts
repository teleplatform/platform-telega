/**
 * Voice Recheck Execution Readiness Memory v2.9
 *
 * Stores and summarizes history of recheck execution gate decisions
 * per chat, enabling pattern detection and loop-aware discipline.
 *
 * This layer answers:
 *   - "What has the recheck execution history looked like?"
 *   - "Are we stuck in repeated hold or deny patterns?"
 *   - "When was the last recheck evaluation performed?"
 *
 * This layer does NOT:
 *   - change execution gate logic
 *   - alter scheduling strategy
 *   - mutate workflow state
 *   - launch recheck execution
 *   - mutate runtime config
 *   - use DB / ML / external dependencies
 */

import type { VoiceRecheckExecutionDecision } from "./voiceWorkflowRecheckExecutionGate.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceRecheckExecutionOutcome = VoiceRecheckExecutionDecision;

export interface VoiceRecheckExecutionMemoryEntry {
  chatId: string | number;
  storedAtMs: number;

  decision: VoiceRecheckExecutionOutcome;
  reasonClass: "timing_ok" | "insufficient_delta" | "still_blocked" | "cooldown_active";

  hadMeaningfulNewSignals: boolean;
  recoveryActive: boolean;
}

export interface VoiceRecheckExecutionReadinessSummary {
  totalChecks: number;

  allowCount: number;
  holdCount: number;
  denyCount: number;

  lastDecision: VoiceRecheckExecutionOutcome | null;
  lastCheckAtMs: number | null;

  repeatedHoldPattern: boolean;
  repeatedDenyPattern: boolean;
}

// ============================================================================
// Bounded in-memory store
// ============================================================================

const MAX_HISTORY_PER_CHAT = 20;

const memoryStore = new Map<string | number, VoiceRecheckExecutionMemoryEntry[]>();

function getHistoryForChat(chatId: string | number): VoiceRecheckExecutionMemoryEntry[] {
  return memoryStore.get(chatId) ?? [];
}

// ============================================================================
// Core memory functions
// ============================================================================

/**
 * Record a recheck execution decision in memory.
 * Bounded: evicts oldest entries when exceeding MAX_HISTORY_PER_CHAT.
 */
export function recordVoiceRecheckExecutionDecision(
  chatId: string | number,
  entry: Omit<VoiceRecheckExecutionMemoryEntry, "chatId" | "storedAtMs">,
): VoiceRecheckExecutionMemoryEntry {
  const fullEntry: VoiceRecheckExecutionMemoryEntry = {
    ...entry,
    chatId,
    storedAtMs: Date.now(),
  };

  const history = getHistoryForChat(chatId);
  history.push(fullEntry);

  // Evict oldest entries if exceeding bound
  if (history.length > MAX_HISTORY_PER_CHAT) {
    history.splice(0, history.length - MAX_HISTORY_PER_CHAT);
  }

  memoryStore.set(chatId, history);

  return fullEntry;
}

/**
 * Get full recheck execution history for a chat.
 */
export function getVoiceRecheckExecutionHistory(
  chatId: string | number,
): VoiceRecheckExecutionMemoryEntry[] {
  return [...getHistoryForChat(chatId)];
}

/**
 * Build a readiness summary from stored history for a chat.
 * Pure function — deterministic, bounded, read-only.
 */
export function getVoiceRecheckExecutionReadinessSummary(
  chatId: string | number,
): VoiceRecheckExecutionReadinessSummary {
  const history = getHistoryForChat(chatId);

  if (history.length === 0) {
    return {
      totalChecks: 0,
      allowCount: 0,
      holdCount: 0,
      denyCount: 0,
      lastDecision: null,
      lastCheckAtMs: null,
      repeatedHoldPattern: false,
      repeatedDenyPattern: false,
    };
  }

  let allowCount = 0;
  let holdCount = 0;
  let denyCount = 0;

  for (const entry of history) {
    switch (entry.decision) {
      case "allow_recheck":
        allowCount++;
        break;
      case "hold_recheck":
        holdCount++;
        break;
      case "deny_recheck":
        denyCount++;
        break;
    }
  }

  const lastEntry = history[history.length - 1];
  const lastDecision = lastEntry.decision;
  const lastCheckAtMs = lastEntry.storedAtMs;

  // repeatedHoldPattern: last 3 decisions are all hold_recheck
  const repeatedHoldPattern = history.length >= 3 && history.slice(-3).every(
    (e) => e.decision === "hold_recheck",
  );

  // repeatedDenyPattern: last 2 decisions are all deny_recheck
  const repeatedDenyPattern = history.length >= 2 && history.slice(-2).every(
    (e) => e.decision === "deny_recheck",
  );

  return {
    totalChecks: history.length,
    allowCount,
    holdCount,
    denyCount,
    lastDecision,
    lastCheckAtMs,
    repeatedHoldPattern,
    repeatedDenyPattern,
  };
}

/**
 * Clear recheck execution memory for a specific chat, or all chats if no chatId provided.
 */
export function clearVoiceRecheckExecutionMemory(
  chatId?: string | number,
): void {
  if (chatId !== undefined) {
    memoryStore.delete(chatId);
  } else {
    memoryStore.clear();
  }
}

// ============================================================================
// Formatter for human reading
// ============================================================================

/**
 * Format a recheck execution readiness summary for operator review.
 * Designed for CLI output, Telegram admin messages, or future dashboards.
 */
export function formatVoiceRecheckExecutionReadinessSummary(
  summary: VoiceRecheckExecutionReadinessSummary,
): string {
  const lines = [
    `🧠 Voice Recheck Readiness Memory`,
    `• total checks: ${summary.totalChecks}`,
    `• allow: ${summary.allowCount}`,
    `• hold: ${summary.holdCount}`,
    `• deny: ${summary.denyCount}`,
    `• last decision: ${summary.lastDecision ?? "N/A"}`,
    `• last check at: ${summary.lastCheckAtMs !== null ? new Date(summary.lastCheckAtMs).toISOString() : "N/A"}`,
    `• repeated hold pattern: ${summary.repeatedHoldPattern ? "yes" : "no"}`,
    `• repeated deny pattern: ${summary.repeatedDenyPattern ? "yes" : "no"}`,
  ];

  return lines.join("\n");
}
