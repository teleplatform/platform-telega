/**
 * Voice Learning Signal Aggregation & Governed Adaptation Intelligence v4.9
 *
 * Takes outcome verification results and stability watch data to generate
 * learning signals, aggregate them into patterns, and produce system-level
 * insights — without mutating any runtime config.
 *
 * This layer answers:
 *   - "What have we learned from all these changes?"
 *   - "Which strategies consistently work or fail?"
 *   - "What patterns should influence future governance?"
 *
 * This layer does NOT:
 *   - change runtime config
 *   - apply any adaptations
 *   - mutate execution truth
 *   - use DB / ML / external dependencies
 */

import crypto from "node:crypto";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceLearningSignalSource =
  | "outcome_verification"
  | "stability_watch"
  | "rollback_event";

export type VoiceLearningSignalType =
  | "success_pattern"
  | "no_effect_pattern"
  | "regression_pattern"
  | "drift_pattern"
  | "high_risk_pattern";

export type VoiceLearningConfidence = "low" | "medium" | "high";

export interface VoiceLearningSignal {
  signalId: string;
  source: VoiceLearningSignalSource;
  applyId: string;
  proposalId: string;
  traceId: string;
  signalType: VoiceLearningSignalType;
  weight: number; // 0–1
  confidence: VoiceLearningConfidence;
  observedAt: number;
}

export type VoiceInsightPatternType =
  | "effective_strategy"
  | "ineffective_strategy"
  | "unstable_strategy"
  | "high_risk_pattern";

export type VoiceInsightRecommendation =
  | "reinforce"
  | "adjust"
  | "deprecate"
  | "block";

export interface VoiceAggregatedInsight {
  insightId: string;
  patternType: VoiceInsightPatternType;
  relatedProposals: string[];
  relatedSignals: string[];
  signalCount: number;
  avgWeight: number;
  confidenceScore: number; // 0–100
  recommendation: VoiceInsightRecommendation;
  createdAt: number;
}

export interface AggregateVoiceLearningInput {
  traceId: string;
  applyId: string;
  proposalId: string;
  proposalType: string;
  outcomeStatus?: string;
  outcomeConfidence?: string;
  watchStatus?: string;
  driftScore?: number;
  wasRolledBack?: boolean;
}

// ============================================================================
// ID generation
// ============================================================================

function generateSignalId(): string {
  const ts = Date.now();
  const rand = crypto.randomBytes(3).toString("hex");
  return `voice_signal_${ts}_${rand}`;
}

function generateInsightId(): string {
  const ts = Date.now();
  const rand = crypto.randomBytes(3).toString("hex");
  return `voice_insight_${ts}_${rand}`;
}

// ============================================================================
// Signal generation
// ============================================================================

function mapOutcomeToSignal(
  input: AggregateVoiceLearningInput,
): VoiceLearningSignal | null {
  const { outcomeStatus, outcomeConfidence } = input;

  if (!outcomeStatus) return null;

  let signalType: VoiceLearningSignalType;
  let weight: number;
  let confidence: VoiceLearningConfidence;

  switch (outcomeStatus) {
    case "confirmed_success":
      signalType = "success_pattern";
      weight = outcomeConfidence === "high" ? 0.9 : 0.6;
      confidence = outcomeConfidence as VoiceLearningConfidence || "medium";
      break;
    case "confirmed_no_effect":
      signalType = "no_effect_pattern";
      weight = 0.5;
      confidence = "medium";
      break;
    case "confirmed_regression":
      signalType = "regression_pattern";
      weight = 0.8;
      confidence = "high";
      break;
    case "inconclusive":
    case "pending_observation":
    default:
      return null;
  }

  return {
    signalId: generateSignalId(),
    source: "outcome_verification",
    applyId: input.applyId,
    proposalId: input.proposalId,
    traceId: input.traceId,
    signalType,
    weight,
    confidence,
    observedAt: Date.now(),
  };
}

function mapStabilityToSignal(
  input: AggregateVoiceLearningInput,
): VoiceLearningSignal | null {
  const { watchStatus, driftScore } = input;

  if (!watchStatus) return null;

  let signalType: VoiceLearningSignalType;
  let weight: number;

  switch (watchStatus) {
    case "stable":
      signalType = "success_pattern";
      weight = 0.7;
      break;
    case "drifting":
      signalType = "drift_pattern";
      weight = driftScore !== undefined ? Math.min(1, driftScore / 100) : 0.5;
      break;
    case "unstable":
      signalType = "regression_pattern";
      weight = 0.9;
      break;
    case "active":
    case "terminated":
    default:
      return null;
  }

  return {
    signalId: generateSignalId(),
    source: "stability_watch",
    applyId: input.applyId,
    proposalId: input.proposalId,
    traceId: input.traceId,
    signalType,
    weight,
    confidence: watchStatus === "unstable" ? "high" : "medium",
    observedAt: Date.now(),
  };
}

function mapRollbackToSignal(
  input: AggregateVoiceLearningInput,
): VoiceLearningSignal | null {
  if (!input.wasRolledBack) return null;

  return {
    signalId: generateSignalId(),
    source: "rollback_event",
    applyId: input.applyId,
    proposalId: input.proposalId,
    traceId: input.traceId,
    signalType: "high_risk_pattern",
    weight: 1.0,
    confidence: "high" as const,
    observedAt: Date.now(),
  };
}

// ============================================================================
// Insight aggregation
// ============================================================================

function aggregateSignalsIntoInsight(
  signals: VoiceLearningSignal[],
): VoiceAggregatedInsight | null {
  if (signals.length === 0) return null;

  // Group by signalType
  const groups = new Map<VoiceLearningSignalType, VoiceLearningSignal[]>();
  for (const sig of signals) {
    const existing = groups.get(sig.signalType) || [];
    existing.push(sig);
    groups.set(sig.signalType, existing);
  }

  // Find dominant pattern
  let dominantType: VoiceLearningSignalType | null = null;
  let dominantSignals: VoiceLearningSignal[] = [];

  for (const [type, sigs] of groups.entries()) {
    if (sigs.length > dominantSignals.length) {
      dominantType = type;
      dominantSignals = sigs;
    }
  }

  if (!dominantType) return null;

  // Map to insight
  const patternType = mapSignalTypeToInsightPattern(dominantType);
  const recommendation = mapPatternToRecommendation(patternType);
  const avgWeight = dominantSignals.reduce((s, x) => s + x.weight, 0) / dominantSignals.length;
  const confidenceScore = Math.round(avgWeight * 100);

  return {
    insightId: generateInsightId(),
    patternType,
    relatedProposals: [...new Set(dominantSignals.map(s => s.proposalId))],
    relatedSignals: dominantSignals.map(s => s.signalId),
    signalCount: dominantSignals.length,
    avgWeight: Math.round(avgWeight * 100) / 100,
    confidenceScore,
    recommendation,
    createdAt: Date.now(),
  };
}

function mapSignalTypeToInsightPattern(
  signalType: VoiceLearningSignalType,
): VoiceInsightPatternType {
  switch (signalType) {
    case "success_pattern": return "effective_strategy";
    case "no_effect_pattern": return "ineffective_strategy";
    case "regression_pattern": return "unstable_strategy";
    case "drift_pattern": return "unstable_strategy";
    case "high_risk_pattern": return "high_risk_pattern";
  }
}

function mapPatternToRecommendation(
  patternType: VoiceInsightPatternType,
): VoiceInsightRecommendation {
  switch (patternType) {
    case "effective_strategy": return "reinforce";
    case "ineffective_strategy": return "adjust";
    case "unstable_strategy": return "deprecate";
    case "high_risk_pattern": return "block";
  }
}

// ============================================================================
// Core aggregation function
// ============================================================================

/**
 * Aggregate learning signals from governance outcomes into insights.
 * Pure function — deterministic, bounded, read-only.
 */
export function aggregateVoiceLearningSignals(
  input: AggregateVoiceLearningInput,
): {
  signals: VoiceLearningSignal[];
  insight: VoiceAggregatedInsight | null;
} {
  const signals: VoiceLearningSignal[] = [];

  const outcomeSignal = mapOutcomeToSignal(input);
  if (outcomeSignal) signals.push(outcomeSignal);

  const stabilitySignal = mapStabilityToSignal(input);
  if (stabilitySignal) signals.push(stabilitySignal);

  const rollbackSignal = mapRollbackToSignal(input);
  if (rollbackSignal) signals.push(rollbackSignal);

  const insight = aggregateSignalsIntoInsight(signals);

  return { signals, insight };
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceLearningSignal(
  signal: VoiceLearningSignal,
): string {
  return [
    `📡 Voice Learning Signal`,
    `• signal ID: ${signal.signalId}`,
    `• source: ${signal.source}`,
    `• type: ${signal.signalType}`,
    `• weight: ${signal.weight}`,
    `• confidence: ${signal.confidence}`,
  ].join("\n");
}

export function formatVoiceAggregatedInsight(
  insight: VoiceAggregatedInsight,
): string {
  return [
    `🧠 Voice Aggregated Insight`,
    `• insight ID: ${insight.insightId}`,
    `• pattern: ${insight.patternType}`,
    `• signals: ${insight.signalCount}`,
    `• avg weight: ${insight.avgWeight}`,
    `• confidence: ${insight.confidenceScore}%`,
    `• recommendation: ${insight.recommendation}`,
    `• proposals: ${insight.relatedProposals.join(", ")}`,
  ].join("\n");
}
