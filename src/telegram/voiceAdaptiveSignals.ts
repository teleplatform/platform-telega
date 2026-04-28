/**
 * Voice Adaptive Learning Signals Layer v1.0
 *
 * Bounded execution signal collector — observes and records voice runtime outcomes
 * WITHOUT modifying runtime decisions or self-modifying behavior.
 *
 * This layer:
 *   - collects execution signals after send/fallback/abort
 *   - maintains bounded in-memory signal history (max 200)
 *   - provides aggregated summary of voice stack behavior
 *   - does NOT change runtime decisions
 *   - does NOT self-modify behavior
 *   - does NOT use ML / LLM / embeddings
 *   - does NOT persist to DB
 */

// ============================================================================
// Domain model
// ============================================================================

export interface VoiceExecutionSignal {
  chatId: string | number;
  traceId: string;

  deliveryMode: "fast_voice" | "quality_voice" | "text_only";
  admissionMode: "send_voice" | "send_voice_with_caution" | "downgrade_to_text";

  qualityScore: number;

  failureOccurred: boolean;
  fallbackUsed: boolean;

  interruptionBlocked: boolean;

  latencyMs?: number;

  timestampMs: number;
}

export interface VoiceAdaptiveSummary {
  totalSignals: number;

  avgQualityScore: number;

  voiceSuccessRate: number;
  fallbackRate: number;
  interruptionBlockRate: number;

  fastVsQualityRatio: {
    fast: number;
    quality: number;
  };
}

// ============================================================================
// Bounded in-memory signal store
// ============================================================================

const voiceSignals: VoiceExecutionSignal[] = [];
const MAX_SIGNALS = 200;

/**
 * Record a voice execution signal.
 * Bounded: keeps only the last MAX_SIGNALS entries.
 */
export function recordVoiceExecutionSignal(signal: VoiceExecutionSignal): void {
  voiceSignals.push(signal);

  // Bounded memory: drop oldest if exceeding limit
  if (voiceSignals.length > MAX_SIGNALS) {
    voiceSignals.splice(0, voiceSignals.length - MAX_SIGNALS);
  }
}

/**
 * Get aggregated summary of voice runtime behavior.
 * Deterministic — pure aggregation, no side effects.
 */
export function getVoiceAdaptiveSummary(): VoiceAdaptiveSummary {
  const total = voiceSignals.length;

  if (total === 0) {
    return {
      totalSignals: 0,
      avgQualityScore: 0,
      voiceSuccessRate: 0,
      fallbackRate: 0,
      interruptionBlockRate: 0,
      fastVsQualityRatio: { fast: 0, quality: 0 },
    };
  }

  // Average quality score
  const totalQuality = voiceSignals.reduce((sum, s) => sum + s.qualityScore, 0);
  const avgQualityScore = Math.round(totalQuality / total);

  // Voice success rate: admissionMode === "send_voice" or "send_voice_with_caution"
  const voiceSent = voiceSignals.filter(
    (s) => s.admissionMode === "send_voice" || s.admissionMode === "send_voice_with_caution",
  ).length;
  const voiceSuccessRate = Math.round((voiceSent / total) * 100);

  // Fallback rate: fallbackUsed === true
  const fallbackCount = voiceSignals.filter((s) => s.fallbackUsed).length;
  const fallbackRate = Math.round((fallbackCount / total) * 100);

  // Interruption block rate: interruptionBlocked === true
  const interruptionCount = voiceSignals.filter((s) => s.interruptionBlocked).length;
  const interruptionBlockRate = Math.round((interruptionCount / total) * 100);

  // Fast vs quality ratio
  const fastCount = voiceSignals.filter((s) => s.deliveryMode === "fast_voice").length;
  const qualityCount = voiceSignals.filter((s) => s.deliveryMode === "quality_voice").length;

  return {
    totalSignals: total,
    avgQualityScore,
    voiceSuccessRate,
    fallbackRate,
    interruptionBlockRate,
    fastVsQualityRatio: {
      fast: fastCount,
      quality: qualityCount,
    },
  };
}

/**
 * Reset all voice execution signals (testing/cleanup only).
 */
export function resetVoiceSignals(): void {
  voiceSignals.length = 0;
}

/**
 * Get the current signal count (for observability/testing).
 */
export function getVoiceSignalsCount(): number {
  return voiceSignals.length;
}

/**
 * Get the last N signals (for debugging/inspection).
 */
export function getRecentVoiceSignals(n: number = 10): VoiceExecutionSignal[] {
  return voiceSignals.slice(-n);
}
