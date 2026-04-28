/**
 * Voice Change Stability Watch & Drift Control Layer v4.8
 *
 * Monitors confirmed successful changes over time to detect drift,
 * degradation, or instability — enabling long-term governance of
 * applied changes rather than one-time apply validation.
 *
 * This layer answers:
 *   - "Is the change still producing the expected effect over time?"
 *   - "Is there drift or degradation in the change's impact?"
 *   - "Should we escalate, warn, or recommend rollback?"
 *
 * This layer does NOT:
 *   - change runtime config
 *   - rollback automatically (advisory only)
 *   - mutate execution truth
 *   - use DB / ML / external dependencies
 */

import crypto from "node:crypto";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceStabilityWatchStatus =
  | "active"
  | "stable"
  | "drifting"
  | "unstable"
  | "terminated";

export type VoiceStabilityTrend =
  | "improving"
  | "flat"
  | "degrading"
  | "volatile";

export interface VoiceStabilitySignal {
  metric: string;
  trend: VoiceStabilityTrend;
  value?: number;
}

export interface VoiceChangeStabilityWatch {
  watchId: string;

  applyId: string;
  proposalId: string;
  traceId: string;

  watchStatus: VoiceStabilityWatchStatus;

  monitoringWindowMs: number;

  stabilitySignals: VoiceStabilitySignal[];

  driftScore: number; // 0-100

  lastCheckedAt?: number;
}

export interface EvaluateVoiceStabilityWatchInput {
  applyId: string;
  proposalId: string;
  traceId: string;

  monitoringWindowMs: number;

  signals: VoiceStabilitySignal[];

  // Previous drift score for trend calculation
  previousDriftScore?: number;
}

export type VoiceDriftAction =
  | "none"
  | "warning"
  | "escalate"
  | "recommend_rollback";

// ============================================================================
// Drift thresholds
// ============================================================================

export const DRIFT_THRESHOLDS = {
  warning: 60,
  escalate: 80,
  recommendRollback: 90,
} as const;

// ============================================================================
// ID generation
// ============================================================================

function generateWatchId(): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(3).toString("hex");
  return `voice_watch_${timestamp}_${random}`;
}

// ============================================================================
// Drift score calculation
// ============================================================================

function calculateDriftScore(
  signals: VoiceStabilitySignal[],
  previousDriftScore?: number,
): number {
  if (signals.length === 0) {
    return previousDriftScore ?? 0;
  }

  // Weight by trend severity
  const trendWeights: Record<VoiceStabilityTrend, number> = {
    improving: -10,
    flat: 0,
    degrading: 25,
    volatile: 35,
  };

  const avgTrendScore =
    signals.reduce((sum, s) => sum + (trendWeights[s.trend] ?? 0), 0) /
    signals.length;

  // Clamp to 0-100
  let score = Math.max(0, Math.min(100, avgTrendScore));

  // If previous score exists, blend (70% new, 30% previous) for stability
  if (previousDriftScore !== undefined) {
    score = Math.round(score * 0.7 + previousDriftScore * 0.3);
  }

  return Math.round(score);
}

// ============================================================================
// Watch status classification
// ============================================================================

function classifyWatchStatus(
  driftScore: number,
  signals: VoiceStabilitySignal[],
): VoiceStabilityWatchStatus {
  // No signals → active (awaiting data)
  if (signals.length === 0) {
    return "active";
  }

  // All improving or flat with low drift → stable
  const hasDegrading = signals.some((s) => s.trend === "degrading");
  const hasVolatile = signals.some((s) => s.trend === "volatile");

  if (!hasDegrading && !hasVolatile && driftScore < DRIFT_THRESHOLDS.warning) {
    return "stable";
  }

  // High volatility or degrading → unstable
  if (driftScore >= DRIFT_THRESHOLDS.escalate || hasVolatile) {
    return "unstable";
  }

  // Some degradation but not critical → drifting
  if (hasDegrading || driftScore >= DRIFT_THRESHOLDS.warning) {
    return "drifting";
  }

  return "active";
}

// ============================================================================
// Drift action recommendation
// ============================================================================

function recommendDriftAction(
  driftScore: number,
): VoiceDriftAction {
  if (driftScore >= DRIFT_THRESHOLDS.recommendRollback) {
    return "recommend_rollback";
  }
  if (driftScore >= DRIFT_THRESHOLDS.escalate) {
    return "escalate";
  }
  if (driftScore >= DRIFT_THRESHOLDS.warning) {
    return "warning";
  }
  return "none";
}

// ============================================================================
// Core stability watch evaluator
// ============================================================================

/**
 * Evaluate stability watch status and drift score.
 * Pure function — deterministic, bounded, read-only.
 */
export function evaluateVoiceStabilityWatch(
  input: EvaluateVoiceStabilityWatchInput,
): {
  watch: VoiceChangeStabilityWatch;
  recommendedAction: VoiceDriftAction;
} {
  const driftScore = calculateDriftScore(
    input.signals,
    input.previousDriftScore,
  );

  const watchStatus = classifyWatchStatus(driftScore, input.signals);
  const recommendedAction = recommendDriftAction(driftScore);

  const watch: VoiceChangeStabilityWatch = {
    watchId: generateWatchId(),
    applyId: input.applyId,
    proposalId: input.proposalId,
    traceId: input.traceId,
    watchStatus,
    monitoringWindowMs: input.monitoringWindowMs,
    stabilitySignals: input.signals,
    driftScore,
    lastCheckedAt: Date.now(),
  };

  return { watch, recommendedAction };
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceStabilityWatch(
  watch: VoiceChangeStabilityWatch,
  action: VoiceDriftAction,
): string {
  const lines = [
    `🔭 Voice Change Stability Watch`,
    `• watch ID: ${watch.watchId}`,
    `• apply ID: ${watch.applyId}`,
    `• status: ${watch.watchStatus}`,
    `• drift score: ${watch.driftScore}/100`,
    `• recommended action: ${action}`,
    `• signals: ${watch.stabilitySignals.length}`,
  ];

  for (const signal of watch.stabilitySignals) {
    const valueStr = signal.value !== undefined ? ` (${signal.value})` : "";
    lines.push(`    → ${signal.metric}: ${signal.trend}${valueStr}`);
  }

  return lines.join("\n");
}
