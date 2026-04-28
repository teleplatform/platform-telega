/**
 * Voice Governed Adaptation Candidate Synthesis Layer v5.0
 *
 * Takes aggregated insights and learning signals to produce structured
 * adaptation candidates — not actual changes, but candidates that can
 * be evaluated by the governance chain.
 *
 * This layer answers:
 *   - "What adaptation should the system consider based on learned patterns?"
 *   - "Is the evidence strong enough to propose an adaptation?"
 *   - "What is the risk class and support level?"
 *
 * This layer does NOT:
 *   - apply any adaptations
 *   - change runtime config
 *   - mutate execution truth
 *   - use DB / ML / external dependencies
 */

import crypto from "node:crypto";
import type { VoiceAggregatedInsight } from "./voiceLearningSignalAggregation.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceAdaptationTargetDomain =
  | "policy_threshold"
  | "reaction_strategy"
  | "cooling_logic"
  | "review_priority"
  | "admission_screening";

export type VoiceAdaptationCandidateType =
  | "tighten"
  | "loosen"
  | "reroute"
  | "deprecate"
  | "reinforce";

export type VoiceAdaptationSupportLevel =
  | "weak"
  | "moderate"
  | "strong";

export type VoiceAdaptationRiskClass =
  | "low"
  | "medium"
  | "high"
  | "critical";

export interface VoiceAdaptationCandidate {
  candidateId: string;
  traceGroupId: string;

  basedOnInsights: string[];
  basedOnSignals: string[];

  targetDomain: VoiceAdaptationTargetDomain;
  candidateType: VoiceAdaptationCandidateType;

  rationale: string;

  proposedDelta: {
    targetKey: string;
    currentValue?: unknown;
    proposedValue: unknown;
  };

  supportLevel: VoiceAdaptationSupportLevel;
  riskClass: VoiceAdaptationRiskClass;

  requiresHumanReview: boolean;

  createdAt: number;
}

export interface SynthesizeAdaptationCandidateInput {
  traceGroupId: string;
  insight: VoiceAggregatedInsight;
  proposedDelta?: {
    targetKey: string;
    currentValue?: unknown;
    proposedValue: unknown;
  };
}

// ============================================================================
// ID generation
// ============================================================================

function generateCandidateId(): string {
  const ts = Date.now();
  const rand = crypto.randomBytes(3).toString("hex");
  return `voice_candidate_${ts}_${rand}`;
}

// ============================================================================
// Synthesis rules
// ============================================================================

function mapInsightToTargetDomain(
  insight: VoiceAggregatedInsight,
): VoiceAdaptationTargetDomain {
  switch (insight.patternType) {
    case "effective_strategy": return "reinforcement" as any;
    case "ineffective_strategy": return "admission_screening";
    case "unstable_strategy": return "cooling_logic";
    case "high_risk_pattern": return "reaction_strategy";
  }
}

function mapInsightToCandidateType(
  insight: VoiceAggregatedInsight,
): VoiceAdaptationCandidateType {
  switch (insight.recommendation) {
    case "reinforce": return "reinforce";
    case "adjust": return "tighten";
    case "deprecate": return "deprecate";
    case "block": return "tighten";
  }
}

function mapSupportLevel(
  insight: VoiceAggregatedInsight,
): VoiceAdaptationSupportLevel {
  if (insight.confidenceScore >= 80 && insight.signalCount >= 3) return "strong";
  if (insight.confidenceScore >= 50 && insight.signalCount >= 2) return "moderate";
  return "weak";
}

function mapRiskClass(
  insight: VoiceAggregatedInsight,
): VoiceAdaptationRiskClass {
  switch (insight.patternType) {
    case "high_risk_pattern": return "critical";
    case "unstable_strategy": return "high";
    case "ineffective_strategy": return "medium";
    case "effective_strategy": return "low";
  }
}

// ============================================================================
// Core candidate synthesizer
// ============================================================================

/**
 * Synthesize an adaptation candidate from an aggregated insight.
 * Pure function — deterministic, bounded, read-only.
 */
export function synthesizeAdaptationCandidate(
  input: SynthesizeAdaptationCandidateInput,
): VoiceAdaptationCandidate | null {
  const { insight } = input;

  // Must have minimum evidence
  if (insight.signalCount < 2) return null;

  const candidateType = mapInsightToCandidateType(insight);
  const targetDomain = mapInsightToTargetDomain(insight);
  const supportLevel = mapSupportLevel(insight);
  const riskClass = mapRiskClass(insight);
  const requiresHumanReview = riskClass === "high" || riskClass === "critical";

  const rationale = `Based on ${insight.signalCount} signal(s) showing ${insight.patternType} pattern with ${insight.confidenceScore}% confidence. Recommendation: ${insight.recommendation}.`;

  const proposedDelta = input.proposedDelta || {
    targetKey: insight.relatedProposals[0] || "unknown",
    proposedValue: candidateType,
  };

  return {
    candidateId: generateCandidateId(),
    traceGroupId: input.traceGroupId,
    basedOnInsights: [insight.insightId],
    basedOnSignals: insight.relatedSignals,
    targetDomain,
    candidateType,
    rationale,
    proposedDelta,
    supportLevel,
    riskClass,
    requiresHumanReview,
    createdAt: Date.now(),
  };
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceAdaptationCandidate(
  candidate: VoiceAdaptationCandidate,
): string {
  return [
    `🎯 Voice Adaptation Candidate`,
    `• candidate ID: ${candidate.candidateId}`,
    `• target domain: ${candidate.targetDomain}`,
    `• type: ${candidate.candidateType}`,
    `• support: ${candidate.supportLevel}`,
    `• risk: ${candidate.riskClass}`,
    `• human review: ${candidate.requiresHumanReview ? "required" : "not required"}`,
    `• insights: ${candidate.basedOnInsights.length}`,
    `• signals: ${candidate.basedOnSignals.length}`,
    `• rationale: ${candidate.rationale}`,
  ].join("\n");
}
