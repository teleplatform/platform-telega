/**
 * Voice Long-Horizon Adaptation Memory Layer v5.5
 *
 * Tracks historical adaptation outcomes across cycles, classifies patterns
 * as effective/ineffective/unstable/high-risk, and provides recommendations
 * for future adaptation candidates.
 *
 * This layer answers:
 *   - "What have we learned from past adaptations over time?"
 *   - "Which adaptation patterns consistently work or fail?"
 *   - "Should this candidate be preferred, avoided, or require strict review?"
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

export type VoiceAdaptationDomain =
  | "policy_threshold"
  | "reaction_strategy"
  | "cooling_logic"
  | "review_priority"
  | "admission_screening";

export type VoiceAdaptationOutcome =
  | "success"
  | "no_effect"
  | "regression"
  | "rolled_back";

export type VoiceAdaptationStability =
  | "stable"
  | "drifting"
  | "unstable";

export type VoiceAdaptationMemoryClassification =
  | "historically_effective"
  | "historically_ineffective"
  | "historically_unstable"
  | "high_risk_recurrent";

export type VoiceAdaptationMemoryRecommendation =
  | "prefer"
  | "allow_with_review"
  | "avoid"
  | "require_creator_only";

export interface VoiceHistoricalOutcome {
  lineageId: string;
  outcome: VoiceAdaptationOutcome;
  stability: VoiceAdaptationStability;
  observedAt: number;
}

export interface VoiceAdaptationMemoryRecord {
  memoryId: string;
  patternKey: string;
  domain: VoiceAdaptationDomain;
  historicalOutcomes: VoiceHistoricalOutcome[];
  memoryClassification: VoiceAdaptationMemoryClassification;
  confidenceScore: number; // 0–100
  recommendation: VoiceAdaptationMemoryRecommendation;
  lastUpdatedAt: number;
}

export interface UpdateAdaptationMemoryInput {
  patternKey: string;
  domain: VoiceAdaptationDomain;
  lineageId: string;
  outcome: VoiceAdaptationOutcome;
  stability: VoiceAdaptationStability;
  existingMemory?: VoiceAdaptationMemoryRecord;
}

// ============================================================================
// ID generation
// ============================================================================

function generateMemoryId(): string {
  const ts = Date.now();
  const rand = crypto.randomBytes(3).toString("hex");
  return `voice_mem_${ts}_${rand}`;
}

// ============================================================================
// Classification logic
// ============================================================================

function classifyMemory(
  outcomes: VoiceHistoricalOutcome[],
): {
  classification: VoiceAdaptationMemoryClassification;
  recommendation: VoiceAdaptationMemoryRecommendation;
  confidenceScore: number;
} {
  if (outcomes.length === 0) {
    return {
      classification: "historically_effective",
      recommendation: "allow_with_review",
      confidenceScore: 0,
    };
  }

  const successCount = outcomes.filter((o) => o.outcome === "success").length;
  const noEffectCount = outcomes.filter((o) => o.outcome === "no_effect").length;
  const regressionCount = outcomes.filter((o) => o.outcome === "regression").length;
  const rolledBackCount = outcomes.filter((o) => o.outcome === "rolled_back").length;
  const unstableCount = outcomes.filter((o) => o.stability === "unstable").length;
  const driftingCount = outcomes.filter((o) => o.stability === "drifting").length;
  const totalCount = outcomes.length;

  // High risk: repeated regression or rollback
  if (regressionCount >= 2 || rolledBackCount >= 2) {
    const confidence = Math.min(100, (regressionCount + rolledBackCount) * 30);
    return {
      classification: "high_risk_recurrent",
      recommendation: "require_creator_only",
      confidenceScore: confidence,
    };
  }

  // Historically effective: >= 3 successes, 0 unstable
  if (successCount >= 3 && unstableCount === 0) {
    const confidence = Math.min(100, Math.round((successCount / totalCount) * 100));
    return {
      classification: "historically_effective",
      recommendation: "prefer",
      confidenceScore: confidence,
    };
  }

  // Historically unstable: >= 2 unstable outcomes
  if (unstableCount >= 2 || (driftingCount >= 2 && regressionCount >= 1)) {
    const confidence = Math.min(100, (unstableCount + driftingCount) * 25);
    return {
      classification: "historically_unstable",
      recommendation: "avoid",
      confidenceScore: confidence,
    };
  }

  // Historically ineffective: no_effect dominates
  if (noEffectCount >= 2 && successCount < noEffectCount) {
    const confidence = Math.min(100, Math.round((noEffectCount / totalCount) * 80));
    return {
      classification: "historically_ineffective",
      recommendation: "avoid",
      confidenceScore: confidence,
    };
  }

  // Default: allow with review
  const confidence = Math.min(100, Math.round((successCount / Math.max(1, totalCount)) * 60));
  return {
    classification: "historically_effective",
    recommendation: "allow_with_review",
    confidenceScore: confidence,
  };
}

// ============================================================================
// Core memory update function
// ============================================================================

/**
 * Update adaptation memory with a new historical outcome.
 * Pure function — deterministic, bounded, read-only.
 */
export function updateVoiceAdaptationMemory(
  input: UpdateAdaptationMemoryInput,
): VoiceAdaptationMemoryRecord {
  const existingOutcomes = input.existingMemory?.historicalOutcomes ?? [];
  const newOutcome: VoiceHistoricalOutcome = {
    lineageId: input.lineageId,
    outcome: input.outcome,
    stability: input.stability,
    observedAt: Date.now(),
  };

  const updatedOutcomes = [...existingOutcomes, newOutcome];
  const { classification, recommendation, confidenceScore } = classifyMemory(updatedOutcomes);

  return {
    memoryId: input.existingMemory?.memoryId ?? generateMemoryId(),
    patternKey: input.patternKey,
    domain: input.domain,
    historicalOutcomes: updatedOutcomes,
    memoryClassification: classification,
    confidenceScore,
    recommendation,
    lastUpdatedAt: Date.now(),
  };
}

// ============================================================================
// Memory lookup for candidate screening
// ============================================================================

export function checkAdaptationMemory(
  patternKey: string,
  existingMemory?: VoiceAdaptationMemoryRecord,
): { recommendation: VoiceAdaptationMemoryRecommendation; confidenceScore: number; found: boolean } {
  if (!existingMemory) {
    return { recommendation: "allow_with_review", confidenceScore: 0, found: false };
  }
  return {
    recommendation: existingMemory.recommendation,
    confidenceScore: existingMemory.confidenceScore,
    found: true,
  };
}

// ============================================================================
// Formatter
// ============================================================================

export function formatAdaptationMemory(
  memory: VoiceAdaptationMemoryRecord,
): string {
  return [
    `🧠 Voice Long-Horizon Adaptation Memory`,
    `• memory ID: ${memory.memoryId}`,
    `• pattern: ${memory.patternKey}`,
    `• domain: ${memory.domain}`,
    `• classification: ${memory.memoryClassification}`,
    `• recommendation: ${memory.recommendation}`,
    `• confidence: ${memory.confidenceScore}%`,
    `• historical outcomes: ${memory.historicalOutcomes.length}`,
  ].join("\n");
}
