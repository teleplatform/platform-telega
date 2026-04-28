/**
 * Voice Continuity Memory Layer v1.0
 *
 * Bounded recent-turn voice memory — gives next voice turn a continuity hint
 * so consecutive voice replies don't sound like emotional resets.
 *
 * This layer does NOT:
 *   - Persist long-term data (DB, files, migrations)
 *   - Build personality profiles or embeddings
 *   - Use LLM calls or semantic retrieval
 *   - Override current-turn context blindly
 *   - Create sticky emotional carry
 *
 * It ONLY remembers the LAST voice delivery feel per chatId, bounded by time.
 */

// ============================================================================
// Domain model
// ============================================================================

export type VoiceContinuityCarryMode =
  | "inherit_recent"
  | "soft_reset"
  | "hard_reset";

export interface VoiceContinuitySnapshot {
  chatId: string | number;
  storedAtMs: number;

  responseStyle: "warm" | "supportive" | "concise" | "neutral";
  presenceMode: "fresh" | "continuing" | "soft_followup" | "reset";

  cadenceMode:
    | "crisp_direct"
    | "warm_compact"
    | "steady_explanatory"
    | "soft_guided"
    | "supportive_gentle";

  assemblyMode:
    | "direct_spoken"
    | "soft_spoken"
    | "guided_spoken"
    | "supportive_spoken";

  smoothingEntryMode:
    | "clean_direct_entry"
    | "soft_continuation_entry"
    | "warm_reentry_entry"
    | "supportive_gentle_entry";

  smoothingExitMode:
    | "clean_stop"
    | "soft_landing"
    | "warm_hold"
    | "supportive_hold";
}

export interface VoiceContinuityDecision {
  carryMode: VoiceContinuityCarryMode;

  shouldInheritStyle: boolean;
  shouldInheritCadenceBias: boolean;
  shouldInheritWarmth: boolean;
  shouldInheritSupportiveTone: boolean;
  shouldResetToNeutral: boolean;

  hints: string[];
  warnings: string[];
}

// ============================================================================
// Bounded in-memory registry
// ============================================================================

type VoiceContinuityState = {
  snapshot: VoiceContinuitySnapshot;
};

const voiceContinuityMap = new Map<string | number, VoiceContinuityState>();

// ============================================================================
// Time window constants
// ============================================================================

/** Within this window, recent feel is safely inheritable */
const RECENT_CONTINUITY_WINDOW_MS = 8 * 60 * 1000; // 8 minutes

/** Beyond this window, continuity degrades to hard reset */
const SOFT_RESET_WINDOW_MS = 25 * 60 * 1000; // 25 minutes

// ============================================================================
// Core functions
// ============================================================================

/**
 * Store a voice continuity snapshot for a chat.
 * Replaces any previous snapshot — only the most recent is kept.
 */
export function rememberVoiceContinuity(snapshot: VoiceContinuitySnapshot): void {
  voiceContinuityMap.set(snapshot.chatId, { snapshot });
}

/**
 * Retrieve the most recent voice continuity snapshot for a chat.
 * Returns null if no snapshot exists.
 */
export function getRecentVoiceContinuity(
  chatId: string | number,
): VoiceContinuitySnapshot | null {
  const state = voiceContinuityMap.get(chatId);
  if (!state) return null;
  return state.snapshot;
}

/**
 * Decide continuity behavior for the next voice turn.
 * Pure function — deterministic, bounded, advisory.
 */
export function decideVoiceContinuity(input: {
  chatId: string | number;
  nowMs?: number;

  nextPresenceMode?: "fresh" | "continuing" | "soft_followup" | "reset";
  nextResponseStyle?: "warm" | "supportive" | "concise" | "neutral";
  isFollowUp?: boolean;
}): VoiceContinuityDecision {
  const now = input.nowMs ?? Date.now();
  const hints: string[] = [];
  const warnings: string[] = [];

  // --- No snapshot → no continuity ---
  const prev = getRecentVoiceContinuity(input.chatId);
  if (!prev) {
    return {
      carryMode: "hard_reset",
      shouldInheritStyle: false,
      shouldInheritCadenceBias: false,
      shouldInheritWarmth: false,
      shouldInheritSupportiveTone: false,
      shouldResetToNeutral: true,
      hints: [],
      warnings: ["no_recent_voice_snapshot"],
    };
  }

  const gapMs = now - prev.storedAtMs;

  // --- RULE B — reset presence forces hard reset ---
  if (input.nextPresenceMode === "reset") {
    return {
      carryMode: "hard_reset",
      shouldInheritStyle: false,
      shouldInheritCadenceBias: false,
      shouldInheritWarmth: false,
      shouldInheritSupportiveTone: false,
      shouldResetToNeutral: true,
      hints: [],
      warnings: ["reset_presence_forces_neutral"],
    };
  }

  // --- RULE C — long gap weakens carry-over ---
  if (gapMs > SOFT_RESET_WINDOW_MS) {
    return {
      carryMode: "hard_reset",
      shouldInheritStyle: false,
      shouldInheritCadenceBias: false,
      shouldInheritWarmth: false,
      shouldInheritSupportiveTone: false,
      shouldResetToNeutral: true,
      hints: [],
      warnings: ["continuity_window_expired"],
    };
  }

  if (gapMs > RECENT_CONTINUITY_WINDOW_MS) {
    // Soft reset zone — partial degradation
    const isFollowUp = input.isFollowUp ?? false;
    const isContinuing =
      input.nextPresenceMode === "continuing" ||
      input.nextPresenceMode === "soft_followup";

    if (isFollowUp || isContinuing) {
      // Allow very limited inheritance in soft window
      return {
        carryMode: "soft_reset",
        shouldInheritStyle: false,
        shouldInheritCadenceBias: true,
        shouldInheritWarmth: false,
        shouldInheritSupportiveTone: false,
        shouldResetToNeutral: false,
        hints: ["stale_voice_memory_soft_reset", "cadence_bias_retained"],
        warnings: ["continuity_window_expired", "supportive_carry_blocked_as_stale"],
      };
    }

    return {
      carryMode: "soft_reset",
      shouldInheritStyle: false,
      shouldInheritCadenceBias: false,
      shouldInheritWarmth: false,
      shouldInheritSupportiveTone: false,
      shouldResetToNeutral: false,
      hints: ["stale_voice_memory_soft_reset"],
      warnings: ["continuity_window_expired", "supportive_carry_blocked_as_stale"],
    };
  }

  // --- Within recent window → RULE A: inherit recent feel ---
  const isFollowUp = input.isFollowUp ?? false;
  const isContinuing =
    input.nextPresenceMode === "continuing" ||
    input.nextPresenceMode === "soft_followup";

  if (!isFollowUp && !isContinuing) {
    // Fresh input within window — limited inheritance
    return {
      carryMode: "inherit_recent",
      shouldInheritStyle: false,
      shouldInheritCadenceBias: true,
      shouldInheritWarmth: false,
      shouldInheritSupportiveTone: false,
      shouldResetToNeutral: false,
      hints: ["recent_voice_feel_can_be_inherited", "cadence_bias_allowed"],
      warnings: [],
    };
  }

  // --- Follow-up / continuing within recent window ---

  // RULE D — supportive continuity should not persist forever
  // (already bounded by recent window, so safe to inherit here)
  const wasSupportive = prev.responseStyle === "supportive";
  const wasWarm = prev.responseStyle === "warm";
  const wasConcise = prev.responseStyle === "concise";

  let shouldInheritWarmth = wasWarm;
  let shouldInheritSupportiveTone = wasSupportive;
  let shouldInheritStyle = true;
  let shouldInheritCadenceBias = true;

  // RULE E — concise/direct continuity can carry safely, short-term only
  if (wasConcise) {
    shouldInheritWarmth = false;
    shouldInheritSupportiveTone = false;
    shouldInheritStyle = true;
    hints.push("directness_carry_allowed_for_followup");
  }

  if (wasSupportive) {
    hints.push("supportive_continuity_preserved_short_term");
  }

  if (wasWarm) {
    hints.push("recent_voice_feel_can_be_inherited");
  }

  hints.push("continuity_bias_applied");

  return {
    carryMode: "inherit_recent",
    shouldInheritStyle,
    shouldInheritCadenceBias,
    shouldInheritWarmth,
    shouldInheritSupportiveTone,
    shouldResetToNeutral: false,
    hints,
    warnings: [],
  };
}

/**
 * Clear continuity memory for a chat (e.g., explicit reset).
 */
export function clearVoiceContinuity(chatId: string | number): void {
  voiceContinuityMap.delete(chatId);
}

/**
 * Clear ALL continuity memory (testing only).
 */
export function resetAllVoiceContinuity(): void {
  voiceContinuityMap.clear();
}

/**
 * Get the current size of the continuity map (for testing/observability).
 */
export function getVoiceContinuityMapSize(): number {
  return voiceContinuityMap.size;
}
