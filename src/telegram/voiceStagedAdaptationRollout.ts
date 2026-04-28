/**
 * Voice Staged Adaptation Rollout & Validated Experiment Layer v5.2
 *
 * Takes gate-approved adaptation candidates and creates staged rollout
 * plans — shadow, limited, staged, or full — with success criteria,
 * stop conditions, and rollback capability.
 *
 * This layer answers:
 *   - "How should this adaptation be rolled out safely?"
 *   - "What are the success criteria and stop conditions?"
 *   - "Should we continue, pause, promote, or rollback?"
 *
 * This layer does NOT:
 *   - execute the rollout
 *   - change runtime config
 *   - mutate execution truth
 *   - use DB / ML / external dependencies
 */

import crypto from "node:crypto";
import type { VoiceAdaptationGateResult } from "./voiceAdaptationConstitutionalGate.js";
import type { VoiceAdaptationCandidate } from "./voiceAdaptationCandidateSynthesis.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceRolloutMode =
  | "shadow"
  | "limited"
  | "staged"
  | "full";

export type VoiceRolloutStatus =
  | "prepared"
  | "running"
  | "paused"
  | "validated"
  | "rolled_back"
  | "failed";

export type VoiceStopConditionType =
  | "regression_detected"
  | "drift_detected"
  | "consistency_violation"
  | "human_abort";

export interface VoiceRolloutStopCondition {
  type: VoiceStopConditionType;
  triggered: boolean;
}

export interface VoiceRolloutSuccessCriteria {
  metric: string;
  expectedDirection: "increase" | "decrease" | "stabilize";
  minConfidence: "medium" | "high";
}

export interface VoiceAdaptationRollout {
  rolloutId: string;
  candidateId: string;

  rolloutMode: VoiceRolloutMode;
  rolloutStatus: VoiceRolloutStatus;

  validationWindowMs: number;

  successCriteria: VoiceRolloutSuccessCriteria[];
  stopConditions: VoiceRolloutStopCondition[];

  createdAt: number;
  updatedAt: number;
}

export type VoiceRolloutDecisionType =
  | "continue"
  | "pause"
  | "promote"
  | "rollback";

export interface VoiceRolloutDecision {
  rolloutId: string;
  decision: VoiceRolloutDecisionType;
  reason: string;
  decidedAt: number;
}

export interface CreateAdaptationRolloutInput {
  candidate: VoiceAdaptationCandidate;
  gateResult: VoiceAdaptationGateResult;
}

export interface EvaluateRolloutDecisionInput {
  rollout: VoiceAdaptationRollout;
  regressionDetected: boolean;
  driftDetected: boolean;
  consistencyViolation: boolean;
  humanAbort: boolean;
  validationSuccess: boolean;
}

// ============================================================================
// ID generation
// ============================================================================

function generateRolloutId(): string {
  const ts = Date.now();
  const rand = crypto.randomBytes(3).toString("hex");
  return `voice_rollout_${ts}_${rand}`;
}

// ============================================================================
// Rollout mode determination
// ============================================================================

function determineRolloutMode(
  gateResult: VoiceAdaptationGateResult,
  candidate: VoiceAdaptationCandidate,
): VoiceRolloutMode {
  if (candidate.riskClass === "critical") return "shadow";
  if (candidate.riskClass === "high") return "limited";
  if (candidate.riskClass === "medium") return "staged";
  return "staged"; // Default to staged, never jump to full
}

// ============================================================================
// Success criteria generation
// ============================================================================

function generateSuccessCriteria(
  candidate: VoiceAdaptationCandidate,
): VoiceRolloutSuccessCriteria[] {
  switch (candidate.candidateType) {
    case "tighten":
      return [
        { metric: "safety_score", expectedDirection: "increase", minConfidence: "high" },
        { metric: "regression_rate", expectedDirection: "decrease", minConfidence: "medium" },
      ];
    case "loosen":
      return [
        { metric: "throughput", expectedDirection: "increase", minConfidence: "medium" },
        { metric: "safety_score", expectedDirection: "stabilize", minConfidence: "high" },
      ];
    case "reinforce":
      return [
        { metric: "stability_score", expectedDirection: "increase", minConfidence: "high" },
      ];
    case "deprecate":
      return [
        { metric: "error_rate", expectedDirection: "decrease", minConfidence: "medium" },
      ];
    default:
      return [
        { metric: "governance_stability", expectedDirection: "stabilize", minConfidence: "medium" },
      ];
  }
}

// ============================================================================
// Stop conditions generation
// ============================================================================

function generateStopConditions(): VoiceRolloutStopCondition[] {
  return [
    { type: "regression_detected", triggered: false },
    { type: "drift_detected", triggered: false },
    { type: "consistency_violation", triggered: false },
    { type: "human_abort", triggered: false },
  ];
}

// ============================================================================
// Core rollout creator
// ============================================================================

/**
 * Create a staged adaptation rollout plan.
 * Pure function — deterministic, bounded, read-only.
 */
export function createAdaptationRollout(
  input: CreateAdaptationRolloutInput,
): VoiceAdaptationRollout {
  const now = Date.now();
  const rolloutMode = determineRolloutMode(input.gateResult, input.candidate);
  const validationWindowMs = getValidationWindow(rolloutMode);

  return {
    rolloutId: generateRolloutId(),
    candidateId: input.candidate.candidateId,
    rolloutMode,
    rolloutStatus: "prepared",
    validationWindowMs,
    successCriteria: generateSuccessCriteria(input.candidate),
    stopConditions: generateStopConditions(),
    createdAt: now,
    updatedAt: now,
  };
}

function getValidationWindow(mode: VoiceRolloutMode): number {
  switch (mode) {
    case "shadow": return 5 * 60 * 1000;      // 5 min
    case "limited": return 15 * 60 * 1000;     // 15 min
    case "staged": return 30 * 60 * 1000;      // 30 min
    case "full": return 60 * 60 * 1000;         // 60 min
  }
}

// ============================================================================
// Rollout decision evaluator
// ============================================================================

/**
 * Evaluate whether a rollout should continue, pause, promote, or rollback.
 * Pure function — deterministic, bounded, read-only.
 */
export function evaluateRolloutDecision(
  input: EvaluateRolloutDecisionInput,
): VoiceRolloutDecision {
  const { regressionDetected, driftDetected, consistencyViolation, humanAbort, validationSuccess } = input;

  // Stop conditions check (highest priority)
  if (humanAbort) {
    return {
      rolloutId: input.rollout.rolloutId,
      decision: "rollback",
      reason: "Human aborted rollout",
      decidedAt: Date.now(),
    };
  }

  if (consistencyViolation) {
    return {
      rolloutId: input.rollout.rolloutId,
      decision: "rollback",
      reason: "Consistency violation detected during rollout",
      decidedAt: Date.now(),
    };
  }

  if (regressionDetected) {
    return {
      rolloutId: input.rollout.rolloutId,
      decision: "rollback",
      reason: "Regression detected during rollout",
      decidedAt: Date.now(),
    };
  }

  if (driftDetected) {
    return {
      rolloutId: input.rollout.rolloutId,
      decision: "pause",
      reason: "Drift detected — pausing for investigation",
      decidedAt: Date.now(),
    };
  }

  // Success check
  if (validationSuccess) {
    if (input.rollout.rolloutMode === "full") {
      return {
        rolloutId: input.rollout.rolloutId,
        decision: "promote",
        reason: "Full rollout validated successfully — promote to complete",
        decidedAt: Date.now(),
      };
    }
    return {
      rolloutId: input.rollout.rolloutId,
      decision: "continue",
      reason: "Staged validation successful — continue to next stage",
      decidedAt: Date.now(),
    };
  }

  // Default: continue monitoring
  return {
    rolloutId: input.rollout.rolloutId,
    decision: "continue",
    reason: "No stop conditions triggered — continue monitoring",
    decidedAt: Date.now(),
  };
}

// ============================================================================
// Formatter
// ============================================================================

export function formatAdaptationRollout(
  rollout: VoiceAdaptationRollout,
): string {
  return [
    `🚀 Voice Adaptation Rollout`,
    `• rollout ID: ${rollout.rolloutId}`,
    `• candidate ID: ${rollout.candidateId}`,
    `• mode: ${rollout.rolloutMode}`,
    `• status: ${rollout.rolloutStatus}`,
    `• validation window: ${(rollout.validationWindowMs / 1000).toFixed(0)}s`,
    `• success criteria: ${rollout.successCriteria.length}`,
    `• stop conditions: ${rollout.stopConditions.length}`,
  ].join("\n");
}

export function formatRolloutDecision(
  decision: VoiceRolloutDecision,
): string {
  return [
    `🔀 Voice Rollout Decision`,
    `• rollout ID: ${decision.rolloutId}`,
    `• decision: ${decision.decision}`,
    `• reason: ${decision.reason}`,
  ].join("\n");
}
