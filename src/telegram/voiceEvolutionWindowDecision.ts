/**
 * Voice Evolution Window & Governed Adaptation Freeze Layer v5.7
 *
 * Determines whether the system is currently in an appropriate state
 * to accept new adaptations — considering budget pressure, stability
 * context, and review load.
 *
 * This layer answers:
 *   - "Is the evolution window currently open, restricted, or frozen?"
 *   - "Should new adaptations be allowed, limited, or blocked entirely?"
 *   - "What is the rationale for the current window state?"
 *
 * This layer does NOT:
 *   - change runtime config
 *   - apply any adaptations
 *   - mutate execution truth
 *   - use DB / ML / external dependencies
 */

import crypto from "node:crypto";
import type { VoiceAdaptationBudgetStatus } from "./voiceAdaptationBudgetPressure.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceEvolutionWindowStatus =
  | "open"
  | "restricted"
  | "frozen";

export type VoiceStabilityContext =
  | "stable"
  | "drifting"
  | "unstable";

export type VoiceReviewLoad =
  | "low"
  | "medium"
  | "high";

export interface VoiceEvolutionWindowDecision {
  decisionId: string;

  budgetStatus: VoiceAdaptationBudgetStatus;
  stabilityContext: VoiceStabilityContext;
  reviewLoad: VoiceReviewLoad;

  evolutionWindowStatus: VoiceEvolutionWindowStatus;

  reasons: string[];

  decidedAt: number;
}

export interface EvaluateEvolutionWindowInput {
  budgetStatus: VoiceAdaptationBudgetStatus;
  stabilityContext: VoiceStabilityContext;
  reviewLoad: VoiceReviewLoad;
}

// ============================================================================
// ID generation
// ============================================================================

function generateWindowDecisionId(): string {
  const ts = Date.now();
  const rand = crypto.randomBytes(3).toString("hex");
  return `voice_window_${ts}_${rand}`;
}

// ============================================================================
// Window evaluation logic
// ============================================================================

/**
 * Evaluate whether the evolution window should be open, restricted, or frozen.
 * Pure function — deterministic, bounded, read-only.
 */
export function evaluateVoiceEvolutionWindow(
  input: EvaluateEvolutionWindowInput,
): VoiceEvolutionWindowDecision {
  const reasons: string[] = [];
  let windowStatus: VoiceEvolutionWindowStatus;

  // FROZEN conditions (highest priority)
  if (input.budgetStatus === "frozen") {
    windowStatus = "frozen";
    reasons.push("evolution_budget_frozen — pressure score critical");
  } else if (input.stabilityContext === "unstable") {
    windowStatus = "frozen";
    reasons.push("system_unstable — adaptation frozen until stability restored");
  }
  // RESTRICTED conditions
  else if (input.budgetStatus === "warming") {
    windowStatus = "restricted";
    reasons.push("evolution_budget_warming — only low/medium risk allowed");
  } else if (input.stabilityContext === "drifting") {
    windowStatus = "restricted";
    reasons.push("system_drifting — restricted to memory-preferred adaptations");
  } else if (input.reviewLoad === "high") {
    windowStatus = "restricted";
    reasons.push("review_load_high — restricted to prevent reviewer overload");
  }
  // OPEN conditions
  else if (
    input.budgetStatus === "healthy" &&
    input.stabilityContext === "stable" &&
    (input.reviewLoad === "low" || input.reviewLoad === "medium")
  ) {
    windowStatus = "open";
    reasons.push("healthy_budget — system stable — review capacity available");
  } else if (input.budgetStatus === "constrained") {
    windowStatus = "restricted";
    reasons.push("evolution_budget_constrained — only low risk preferred adaptations");
  } else {
    // Default: restricted for safety
    windowStatus = "restricted";
    reasons.push("default_restricted — conservative window management");
  }

  return {
    decisionId: generateWindowDecisionId(),
    budgetStatus: input.budgetStatus,
    stabilityContext: input.stabilityContext,
    reviewLoad: input.reviewLoad,
    evolutionWindowStatus: windowStatus,
    reasons,
    decidedAt: Date.now(),
  };
}

// ============================================================================
// Window check helper
// ============================================================================

export function canLaunchAdaptationInWindow(
  window: VoiceEvolutionWindowDecision,
  adaptationRisk: "low" | "medium" | "high" | "critical",
): boolean {
  switch (window.evolutionWindowStatus) {
    case "open":
      return true;
    case "restricted":
      return adaptationRisk === "low";
    case "frozen":
      return false;
  }
}

// ============================================================================
// Formatter
// ============================================================================

export function formatEvolutionWindowDecision(
  decision: VoiceEvolutionWindowDecision,
): string {
  return [
    `🪟 Voice Evolution Window`,
    `• decision ID: ${decision.decisionId}`,
    `• window status: ${decision.evolutionWindowStatus}`,
    `• budget: ${decision.budgetStatus}`,
    `• stability: ${decision.stabilityContext}`,
    `• review load: ${decision.reviewLoad}`,
    `• reasons:`,
    ...decision.reasons.map((r) => `    → ${r}`),
  ].join("\n");
}
