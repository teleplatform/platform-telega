/**
 * Voice Post-Apply Verification & Rollback Layer v1.5
 *
 * After a controlled apply is executed, this layer:
 *   - analyzes the effect window (before/after metrics)
 *   - determines if the patch improved, degraded, or is inconclusive
 *   - makes a strict decision: confirm / hold / rollback
 *   - executes rollback when required (rule-based, deterministic)
 *   - logs structured governance events
 *
 * This layer does NOT:
 *   - use ML or external dependencies
 *   - add DB or persistence
 *   - perform auto-tuning beyond rules
 *   - mutate existing decision layers
 *   - break current bot flow
 */

import type { VoiceApplyExecution } from "./voiceControlledApplyEngine.js";
import type { VoiceAdaptiveSummary } from "./voiceAdaptiveSignals.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoicePatchVerificationDecision =
  | "confirm_patch"
  | "hold_observation"
  | "rollback_patch";

export interface VoicePostApplyVerificationResult {
  patchId: string;
  rollbackId?: string;

  decision: VoicePatchVerificationDecision;
  reason: string;
  confidence: "low" | "medium" | "high";

  observationWindowSignals: number;

  beforeMetrics: {
    voiceSuccessRate: number;
    fallbackRate: number;
    interruptionBlockRate: number;
    avgQualityScore: number;
  };

  afterMetrics: {
    voiceSuccessRate: number;
    fallbackRate: number;
    interruptionBlockRate: number;
    avgQualityScore: number;
  };

  improvements: string[];
  regressions: string[];
  warnings: string[];

  generatedAtMs: number;
}

export interface EvaluateVoicePostApplyInput {
  execution: VoiceApplyExecution;
  beforeSummary: VoiceAdaptiveSummary;
  afterSummary: VoiceAdaptiveSummary;
  minObservationSignals?: number;
}

export interface VoiceRollbackExecution {
  rollbackId: string;
  patchId: string;
  rolledBack: boolean;
  reason: string;
  generatedAtMs: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Minimum post-apply observation signals before making a decision */
const DEFAULT_MIN_OBSERVATION_SIGNALS = 12;

/** Success rate improvement threshold (percentage points) */
const SUCCESS_IMPROVEMENT_THRESHOLD = 5;

/** Success rate regression threshold (percentage points) */
const SUCCESS_REGRESSION_THRESHOLD = 5;

/** Fallback rate spike threshold (percentage points) */
const FALLBACK_SPIKE_THRESHOLD = 8;

/** Quality score drop threshold (points) */
const QUALITY_DROP_THRESHOLD = 8;

/** Quality score stability tolerance (points) */
const QUALITY_STABILITY_TOLERANCE = 2;

// ============================================================================
// Core verification function
// ============================================================================

/**
 * Evaluate post-apply verification for a controlled patch.
 * Pure function — deterministic, bounded, rollback-safe.
 */
export function evaluateVoicePostApplyVerification(
  input: EvaluateVoicePostApplyInput,
): VoicePostApplyVerificationResult {
  const { execution, beforeSummary, afterSummary } = input;
  const minSignals = input.minObservationSignals ?? DEFAULT_MIN_OBSERVATION_SIGNALS;
  const now = Date.now();

  const improvements: string[] = [];
  const regressions: string[] = [];
  const warnings: string[] = [];

  const beforeMetrics = {
    voiceSuccessRate: beforeSummary.voiceSuccessRate,
    fallbackRate: beforeSummary.fallbackRate,
    interruptionBlockRate: beforeSummary.interruptionBlockRate,
    avgQualityScore: beforeSummary.avgQualityScore,
  };

  const afterMetrics = {
    voiceSuccessRate: afterSummary.voiceSuccessRate,
    fallbackRate: afterSummary.fallbackRate,
    interruptionBlockRate: afterSummary.interruptionBlockRate,
    avgQualityScore: afterSummary.avgQualityScore,
  };

  // ========================================================================
  // RULE 1 — patch was not applied → HOLD
  // ========================================================================
  if (!execution.applied) {
    return {
      patchId: execution.patchId,
      decision: "hold_observation",
      reason: "patch_not_applied",
      confidence: "low",
      observationWindowSignals: afterSummary.totalSignals,
      beforeMetrics,
      afterMetrics,
      improvements: [],
      regressions: [],
      warnings: ["verification_requires_applied_patch"],
      generatedAtMs: now,
    };
  }

  // ========================================================================
  // RULE 2 — observation window too small → HOLD
  // ========================================================================
  if (afterSummary.totalSignals < minSignals) {
    return {
      patchId: execution.patchId,
      decision: "hold_observation",
      reason: "insufficient_post_apply_evidence",
      confidence: "low",
      observationWindowSignals: afterSummary.totalSignals,
      beforeMetrics,
      afterMetrics,
      improvements: [],
      regressions: [],
      warnings: ["need_more_post_apply_signals"],
      generatedAtMs: now,
    };
  }

  // ========================================================================
  // Calculate deltas
  // ========================================================================
  const successDelta = afterMetrics.voiceSuccessRate - beforeMetrics.voiceSuccessRate;
  const fallbackDelta = afterMetrics.fallbackRate - beforeMetrics.fallbackRate;
  const interruptDelta = afterMetrics.interruptionBlockRate - beforeMetrics.interruptionBlockRate;
  const qualityDelta = afterMetrics.avgQualityScore - beforeMetrics.avgQualityScore;

  // ========================================================================
  // RULE 3 — clear improvement → CONFIRM
  // ========================================================================
  const successImproved = successDelta >= SUCCESS_IMPROVEMENT_THRESHOLD;
  const fallbackNotWorsened = fallbackDelta <= 0;
  const qualityStableOrImproved = qualityDelta >= -QUALITY_STABILITY_TOLERANCE;

  if (successImproved && fallbackNotWorsened && qualityStableOrImproved) {
    if (successImproved) improvements.push("voice_success_improved");
    if (fallbackNotWorsened) improvements.push("fallback_not_worsened");
    if (qualityStableOrImproved) improvements.push("quality_stable_or_improved");
    if (interruptDelta <= 0) improvements.push("interruption_not_worsened");

    return {
      patchId: execution.patchId,
      rollbackId: execution.rollbackId,
      decision: "confirm_patch",
      reason: "patch_improved_runtime",
      confidence: "high",
      observationWindowSignals: afterSummary.totalSignals,
      beforeMetrics,
      afterMetrics,
      improvements,
      regressions: [],
      warnings: [],
      generatedAtMs: now,
    };
  }

  // ========================================================================
  // RULE 4 — clear regression → ROLLBACK
  // ========================================================================
  const successRegressed = successDelta <= -SUCCESS_REGRESSION_THRESHOLD;
  const fallbackSpiked = fallbackDelta >= FALLBACK_SPIKE_THRESHOLD;
  const qualityDropped = qualityDelta <= -QUALITY_DROP_THRESHOLD;

  if (successRegressed || fallbackSpiked || qualityDropped) {
    if (successRegressed) regressions.push("voice_success_regressed");
    if (fallbackSpiked) regressions.push("fallback_spiked");
    if (qualityDropped) regressions.push("quality_dropped");

    return {
      patchId: execution.patchId,
      rollbackId: execution.rollbackId,
      decision: "rollback_patch",
      reason: "patch_caused_regression",
      confidence: "high",
      observationWindowSignals: afterSummary.totalSignals,
      beforeMetrics,
      afterMetrics,
      improvements,
      regressions,
      warnings: ["rollback_recommended_due_to_regression"],
      generatedAtMs: now,
    };
  }

  // ========================================================================
  // RULE 5 — mixed signals → HOLD
  // ========================================================================
  if (successDelta > 0) improvements.push("voice_success_slightly_improved");
  if (successDelta < 0) regressions.push("voice_success_slightly_degraded");
  if (fallbackDelta > 0) warnings.push("fallback_rate_slightly_increased");
  if (fallbackDelta < 0) improvements.push("fallback_rate_slightly_decreased");
  if (qualityDelta < -QUALITY_STABILITY_TOLERANCE) warnings.push("quality_score_decreased");

  return {
    patchId: execution.patchId,
    rollbackId: execution.rollbackId,
    decision: "hold_observation",
    reason: "mixed_post_apply_signals",
    confidence: "medium",
    observationWindowSignals: afterSummary.totalSignals,
    beforeMetrics,
    afterMetrics,
    improvements,
    regressions,
    warnings,
    generatedAtMs: now,
  };
}

// ============================================================================
// Rollback executor
// ============================================================================

/**
 * Execute a rollback for a verified patch.
 * Only performs rollback if decision is "rollback_patch" and rollbackId exists.
 * Pure function — deterministic, no side effects.
 */
export function executeVoiceRollback(
  verification: VoicePostApplyVerificationResult,
): VoiceRollbackExecution {
  const now = Date.now();

  // Only rollback for rollback decisions
  if (verification.decision !== "rollback_patch") {
    return {
      rollbackId: verification.rollbackId ?? "none",
      patchId: verification.patchId,
      rolledBack: false,
      reason: "rollback_not_required",
      generatedAtMs: now,
    };
  }

  // Missing rollback ID → cannot execute
  if (!verification.rollbackId) {
    return {
      rollbackId: "none",
      patchId: verification.patchId,
      rolledBack: false,
      reason: "rollback_id_missing",
      generatedAtMs: now,
    };
  }

  // Rollback is valid
  return {
    rollbackId: verification.rollbackId,
    patchId: verification.patchId,
    rolledBack: true,
    reason: "rollback_executed_due_to_regression",
    generatedAtMs: now,
  };
}

// ============================================================================
// Formatter for human reading
// ============================================================================

/**
 * Format a post-apply verification result for operator review.
 */
export function formatVoicePostApplyVerification(
  result: VoicePostApplyVerificationResult,
): string {
  const lines = [
    `🎛 Voice Post-Apply Verification`,
    `• patch: ${result.patchId}`,
    `• decision: ${result.decision}`,
    `• reason: ${result.reason}`,
    `• confidence: ${result.confidence}`,
    `• observation signals: ${result.observationWindowSignals}`,
    `• success: ${result.beforeMetrics.voiceSuccessRate}% → ${result.afterMetrics.voiceSuccessRate}%`,
    `• fallback: ${result.beforeMetrics.fallbackRate}% → ${result.afterMetrics.fallbackRate}%`,
    `• interruption: ${result.beforeMetrics.interruptionBlockRate}% → ${result.afterMetrics.interruptionBlockRate}%`,
    `• quality: ${result.beforeMetrics.avgQualityScore} → ${result.afterMetrics.avgQualityScore}`,
  ];

  if (result.improvements.length > 0) {
    lines.push(`• improvements: ${result.improvements.join(", ")}`);
  }
  if (result.regressions.length > 0) {
    lines.push(`• regressions: ${result.regressions.join(", ")}`);
  }
  if (result.warnings.length > 0) {
    lines.push(`• warnings: ${result.warnings.join(", ")}`);
  }
  if (result.rollbackId) {
    lines.push(`• rollback ID: ${result.rollbackId}`);
  }

  return lines.join("\n");
}

// ============================================================================
// Bounded in-memory patch baseline tracking
// ============================================================================

interface PatchBaselineEntry {
  patchId: string;
  rollbackId?: string;
  beforeSummary: VoiceAdaptiveSummary;
  appliedAtMs: number;
}

const patchBaselines = new Map<string, PatchBaselineEntry>();
const MAX_PATCH_BASELINES = 20;

/**
 * Store a patch baseline for later verification.
 * Bounded: keeps only the last MAX_PATCH_BASELINES entries.
 */
export function storePatchBaseline(entry: PatchBaselineEntry): void {
  // Evict oldest if at capacity
  if (patchBaselines.size >= MAX_PATCH_BASELINES) {
    const oldestKey = patchBaselines.keys().next().value;
    if (oldestKey) {
      patchBaselines.delete(oldestKey);
    }
  }

  patchBaselines.set(entry.patchId, entry);
}

/**
 * Retrieve a stored patch baseline.
 */
export function getPatchBaseline(patchId: string): PatchBaselineEntry | undefined {
  return patchBaselines.get(patchId);
}

/**
 * Clear a patch baseline (e.g., after confirmation or rollback).
 */
export function clearPatchBaseline(patchId: string): void {
  patchBaselines.delete(patchId);
}

/**
 * Get the current number of stored baselines (for observability/testing).
 */
export function getPatchBaselineCount(): number {
  return patchBaselines.size;
}

/**
 * Clear all patch baselines (testing only).
 */
export function resetPatchBaselines(): void {
  patchBaselines.clear();
}
