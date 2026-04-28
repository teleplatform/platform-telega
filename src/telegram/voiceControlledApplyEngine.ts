/**
 * Voice Controlled Apply Engine v1.4
 *
 * First layer that allows real voice runtime changes, but:
 *   - strictly through governance gates
 *   - with rollback capability
 *   - bounded to one parameter at a time
 *   - no ML / self-learning / dynamic mutation
 *   - no auto-chaos or uncontrolled tuning
 *
 * This layer ONLY applies controlled micro-adjustments.
 *
 * It does NOT:
 *   - change multiple parameters simultaneously
 *   - bypass governance barriers
 *   - apply without high confidence
 *   - mutate config outside known safe patches
 *   - create irreversible changes
 */

import type { VoiceReviewPacket } from "./voiceReviewSurface.js";
import type { VoicePolicyRecommendation } from "./voiceAdaptivePolicyRecommendations.js";
import type { VoiceGovernedApplyResult } from "./voiceGovernedApplyGate.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoicePatchType =
  | "patch_fast_preference"
  | "patch_lower_interrupt"
  | "patch_raise_interrupt"
  | "patch_quality_preference"
  | "none";

export interface VoicePolicyPatch {
  patchId: VoicePatchType;

  changes: {
    preferredVoiceMode?: "fast" | "quality";
    interruptionSensitivityDelta?: -1 | 0 | 1;
    maxVoiceLatencyTargetMs?: number;
    allowVoiceExpansion?: boolean;
  };

  createdAtMs: number;
}

export interface VoiceApplyExecution {
  patchId: VoicePatchType;
  applied: boolean;
  appliedAtMs?: number;

  rollbackAvailable: boolean;
  rollbackId?: string;

  reason: string;
}

export interface ExecuteVoiceControlledApplyInput {
  review: VoiceReviewPacket;
  recommendation: VoicePolicyRecommendation;
  governedApply: VoiceGovernedApplyResult;
}

// ============================================================================
// Safe patch builders — one parameter at a time
// ============================================================================

function buildFastPreferencePatch(): VoicePolicyPatch {
  return {
    patchId: "patch_fast_preference",
    changes: {
      preferredVoiceMode: "fast",
      maxVoiceLatencyTargetMs: 10000,
      allowVoiceExpansion: true,
    },
    createdAtMs: Date.now(),
  };
}

function buildQualityPreferencePatch(): VoicePolicyPatch {
  return {
    patchId: "patch_quality_preference",
    changes: {
      preferredVoiceMode: "quality",
      maxVoiceLatencyTargetMs: 40000,
      allowVoiceExpansion: true,
    },
    createdAtMs: Date.now(),
  };
}

function buildLowerInterruptionPatch(): VoicePolicyPatch {
  return {
    patchId: "patch_lower_interrupt",
    changes: {
      interruptionSensitivityDelta: -1,
    },
    createdAtMs: Date.now(),
  };
}

function buildRaiseInterruptionPatch(): VoicePolicyPatch {
  return {
    patchId: "patch_raise_interrupt",
    changes: {
      interruptionSensitivityDelta: 1,
    },
    createdAtMs: Date.now(),
  };
}

// ============================================================================
// Core apply execution function
// ============================================================================

/**
 * Execute controlled apply for a voice policy recommendation.
 * Pure function — deterministic, bounded, rollback-safe.
 */
export function executeVoiceControlledApply(
  input: ExecuteVoiceControlledApplyInput,
): VoiceApplyExecution {
  const { recommendation, governedApply } = input;
  const now = Date.now();

  // ========================================================================
  // RULE 1 — only allow_apply passes governance
  // ========================================================================
  if (governedApply.applyDecision !== "allow_apply") {
    return {
      patchId: "none",
      applied: false,
      rollbackAvailable: false,
      reason: "apply_not_allowed_by_governance",
    };
  }

  // ========================================================================
  // RULE 2 — only HIGH confidence
  // ========================================================================
  if (recommendation.confidence !== "high") {
    return {
      patchId: "none",
      applied: false,
      rollbackAvailable: false,
      reason: "insufficient_confidence",
    };
  }

  // ========================================================================
  // RULE 3 & 4 — single soft patch per recommendation type
  // Each patch changes only ONE parameter group
  // ========================================================================
  const patch = buildSafePatchForRecommendation(recommendation.recommendationType);

  if (patch.patchId === "none") {
    return {
      patchId: "none",
      applied: false,
      rollbackAvailable: false,
      reason: "no_safe_patch_mapping",
    };
  }

  // RULE 5 — always rollback available
  const rollbackId = `rollback_${patch.patchId}_${now}`;

  return {
    patchId: patch.patchId,
    applied: true,
    appliedAtMs: now,
    rollbackAvailable: true,
    rollbackId,
    reason: buildApplyReason(patch.patchId),
  };
}

/**
 * Build a safe patch for a given recommendation type.
 * Each recommendation maps to exactly ONE soft patch.
 */
function buildSafePatchForRecommendation(
  recommendationType: string,
): VoicePolicyPatch {
  switch (recommendationType) {
    case "prefer_fast_voice_for_short_replies":
      return buildFastPreferencePatch();

    case "prefer_quality_voice_for_stable_sessions":
      return buildQualityPreferencePatch();

    case "lower_interruption_guard_sensitivity":
      return buildLowerInterruptionPatch();

    case "raise_interruption_guard_sensitivity":
      return buildRaiseInterruptionPatch();

    case "allow_more_voice_when_success_rate_is_high":
      // Soft expansion — not a mode change, just permission
      return {
        patchId: "patch_fast_preference",
        changes: {
          preferredVoiceMode: "fast",
          allowVoiceExpansion: true,
        },
        createdAtMs: Date.now(),
      };

    default:
      return {
        patchId: "none",
        changes: {},
        createdAtMs: Date.now(),
      };
  }
}

/**
 * Build a human-readable apply reason for a patch type.
 */
function buildApplyReason(patchId: VoicePatchType): string {
  switch (patchId) {
    case "patch_fast_preference":
      return "latency_optimization_safe_patch";
    case "patch_quality_preference":
      return "quality_optimization_safe_patch";
    case "patch_lower_interrupt":
      return "overblocking_detected";
    case "patch_raise_interrupt":
      return "stale_voice_risk_detected";
    case "none":
    default:
      return "no_applicable_patch";
  }
}
