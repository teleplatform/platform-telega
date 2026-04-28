/**
 * Voice Post-Apply Effect Verification & Outcome Truth Layer v4.7
 *
 * Takes an applied change and verifies that the expected outcome actually
 * occurred — classifying results as success, no-effect, regression, or
 * inconclusive.
 *
 * This layer answers:
 *   - "Did the applied change actually produce the expected effect?"
 *   - "Was there a regression or no observable impact?"
 *   - "Is the outcome confident enough to close the apply chain?"
 *
 * This layer does NOT:
 *   - change runtime config
 *   - bypass apply validation
 *   - mutate execution truth
 *   - use DB / ML / external dependencies
 */

import crypto from "node:crypto";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceOutcomeStatus =
  | "pending_observation"
  | "confirmed_success"
  | "confirmed_no_effect"
  | "confirmed_regression"
  | "inconclusive";

export type VoiceOutcomeConfidence =
  | "low"
  | "medium"
  | "high";

export interface VoiceApplyOutcomeRecord {
  outcomeId: string;

  applyId: string;
  proposalId: string;
  traceId: string;

  expectedOutcome: {
    metric: string;
    targetDirection: "increase" | "decrease" | "stabilize";
    threshold?: number;
  };

  observedOutcome: {
    metric: string;
    observedValue?: number;
    observationWindowMs: number;
  };

  outcomeStatus: VoiceOutcomeStatus;

  confidence: VoiceOutcomeConfidence;

  observedAt?: number;
}

export interface VerifyVoiceApplyOutcomeInput {
  applyId: string;
  proposalId: string;
  traceId: string;

  expectedOutcome: {
    metric: string;
    targetDirection: "increase" | "decrease" | "stabilize";
    threshold?: number;
  };

  observedValue?: number;
  observationWindowMs: number;

  // For verification: baseline value before apply
  baselineValue?: number;
}

// ============================================================================
// ID generation
// ============================================================================

function generateOutcomeId(): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(3).toString("hex");
  return `voice_outcome_${timestamp}_${random}`;
}

// ============================================================================
// Outcome classification logic
// ============================================================================

function classifyOutcome(
  input: VerifyVoiceApplyOutcomeInput,
): { status: VoiceOutcomeStatus; confidence: VoiceOutcomeConfidence } {
  const { expectedOutcome, observedValue, baselineValue } = input;

  // No observation yet → pending
  if (observedValue === undefined) {
    return { status: "pending_observation", confidence: "low" };
  }

  // No baseline for comparison → inconclusive
  if (baselineValue === undefined) {
    return { status: "inconclusive", confidence: "low" };
  }

  const delta = observedValue - baselineValue;

  switch (expectedOutcome.targetDirection) {
    case "increase": {
      const threshold = expectedOutcome.threshold ?? 0;
      if (delta >= threshold) {
        return { status: "confirmed_success", confidence: "high" };
      }
      if (delta > 0) {
        return { status: "confirmed_success", confidence: "medium" };
      }
      if (delta < -Math.abs(threshold || 1)) {
        return { status: "confirmed_regression", confidence: "high" };
      }
      return { status: "confirmed_no_effect", confidence: "medium" };
    }

    case "decrease": {
      const threshold = expectedOutcome.threshold ?? 0;
      if (delta <= -threshold) {
        return { status: "confirmed_success", confidence: "high" };
      }
      if (delta < 0) {
        // Decreased but not enough to meet threshold
        if (threshold > 0) {
          return { status: "confirmed_no_effect", confidence: "medium" };
        }
        return { status: "confirmed_success", confidence: "medium" };
      }
      if (delta > Math.abs(threshold || 1)) {
        return { status: "confirmed_regression", confidence: "high" };
      }
      return { status: "confirmed_no_effect", confidence: "medium" };
    }

    case "stabilize": {
      const threshold = expectedOutcome.threshold ?? 5;
      if (Math.abs(delta) <= threshold) {
        return { status: "confirmed_success", confidence: "medium" };
      }
      if (Math.abs(delta) > threshold * 2) {
        return { status: "confirmed_regression", confidence: "medium" };
      }
      return { status: "confirmed_no_effect", confidence: "low" };
    }
  }
}

// ============================================================================
// Core verification function
// ============================================================================

/**
 * Verify the outcome of an applied change.
 * Pure function — deterministic, bounded, read-only.
 */
export function verifyVoiceApplyOutcome(
  input: VerifyVoiceApplyOutcomeInput,
): VoiceApplyOutcomeRecord {
  const { status, confidence } = classifyOutcome(input);

  return {
    outcomeId: generateOutcomeId(),
    applyId: input.applyId,
    proposalId: input.proposalId,
    traceId: input.traceId,
    expectedOutcome: input.expectedOutcome,
    observedOutcome: {
      metric: input.expectedOutcome.metric,
      observedValue: input.observedValue,
      observationWindowMs: input.observationWindowMs,
    },
    outcomeStatus: status,
    confidence,
    observedAt: input.observedValue !== undefined ? Date.now() : undefined,
  };
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceApplyOutcome(
  outcome: VoiceApplyOutcomeRecord,
): string {
  const lines = [
    `📊 Voice Apply Outcome`,
    `• outcome ID: ${outcome.outcomeId}`,
    `• apply ID: ${outcome.applyId}`,
    `• status: ${outcome.outcomeStatus}`,
    `• confidence: ${outcome.confidence}`,
    `• metric: ${outcome.expectedOutcome.metric}`,
    `• expected: ${outcome.expectedOutcome.targetDirection}`,
  ];

  if (outcome.observedOutcome.observedValue !== undefined) {
    lines.push(`• observed: ${outcome.observedOutcome.observedValue}`);
  }

  return lines.join("\n");
}
