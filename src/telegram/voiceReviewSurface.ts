/**
 * Voice Review & Control Surface Layer v1.3
 *
 * Converts internal voice intelligence (signals + recommendation + governed apply)
 * into structured, human-readable review packets for operator control.
 *
 * This layer:
 *   - builds VoiceReviewPacket from aggregated state
 *   - determines runtime status (healthy/watch/degraded/blocked)
 *   - produces operator summary and suggested actions
 *   - formats for CLI / Telegram admin / future dashboard
 *
 * This layer does NOT:
 *   - mutate runtime state
 *   - auto-apply recommendations
 *   - render UI
 *   - persist to DB
 */

import type { VoiceAdaptiveSummary } from "./voiceAdaptiveSignals.js";
import type { VoicePolicyRecommendation } from "./voiceAdaptivePolicyRecommendations.js";
import type { VoiceGovernedApplyResult } from "./voiceGovernedApplyGate.js";

// ============================================================================
// Domain model
// ============================================================================

/** Alias used internally for status determination logic */
type VoiceAdaptiveSignalsSummary = VoiceAdaptiveSummary;

export type VoiceReviewStatus = "healthy" | "watch" | "degraded" | "blocked";

export interface VoiceReviewPacket {
  generatedAtMs: number;

  status: VoiceReviewStatus;

  headline: string;
  operatorSummary: string;

  metrics: {
    voiceSuccessRate: number;
    fallbackRate: number;
    interruptionBlockRate: number;
    avgQualityScore: number;
    avgLatencyMs: number;
    totalSignals: number;
  };

  recommendation: {
    type: string;
    confidence: string;
    summary: string;
  };

  governance: {
    applyDecision: string;
    reason: string;
    confidence: string;
    safeApplyMode: string;
  };

  blockers: string[];
  warnings: string[];
  suggestedOperatorAction: string;
}

export interface BuildVoiceReviewPacketInput {
  summary: VoiceAdaptiveSummary;
  recommendation: VoicePolicyRecommendation;
  governedApply: VoiceGovernedApplyResult;
}

// ============================================================================
// Status determination logic
// ============================================================================

function determineReviewStatus(
  summary: VoiceAdaptiveSignalsSummary,
  recommendation: VoicePolicyRecommendation,
  governedApply: VoiceGovernedApplyResult,
): VoiceReviewStatus {
  // BLOCKED: governed apply = deny
  if (governedApply.applyDecision === "deny") {
    return "blocked";
  }

  // DEGRADED: high fallback, low success, reduce_voice recommendation
  if (
    summary.fallbackRate > 30 ||
    summary.voiceSuccessRate < 60 ||
    recommendation.recommendationType === "reduce_voice_usage_when_fallback_spikes" ||
    summary.avgQualityScore < 40
  ) {
    return "degraded";
  }

  // WATCH: recommendation on hold, or warning patterns
  if (
    governedApply.applyDecision === "hold" ||
    recommendation.recommendationType !== "no_change" ||
    governedApply.warnings.length > 0
  ) {
    return "watch";
  }

  // HEALTHY: strong runtime, no concerning patterns
  return "healthy";
}

function determineHeadline(status: VoiceReviewStatus, recommendation: VoicePolicyRecommendation): string {
  switch (status) {
    case "blocked":
      return "Voice runtime blocked — governance deny active";
    case "degraded":
      return "Voice runtime degraded — active delivery issues detected";
    case "watch":
      if (recommendation.recommendationType === "no_change") {
        return "Voice runtime stable with minor warnings";
      }
      return `Voice runtime stable but adaptation is on hold: ${recommendation.recommendationType.replace(/_/g, " ")}`;
    case "healthy":
    default:
      return "Voice runtime healthy — no action required";
  }
}

function determineOperatorSummary(
  status: VoiceReviewStatus,
  recommendation: VoicePolicyRecommendation,
  governedApply: VoiceGovernedApplyResult,
  summary: VoiceAdaptiveSignalsSummary,
): string {
  switch (status) {
    case "blocked":
      return `Voice runtime is in blocked state. Governed apply gate denied with reason: ${governedApply.reason}. Delivery instability detected — success rate ${summary.voiceSuccessRate}%, fallback rate ${summary.fallbackRate}%. Do not attempt policy changes until runtime stabilizes.`;
    case "degraded":
      return `Voice runtime showing degradation. ${recommendation.summary} Fallback rate is ${summary.fallbackRate}% and success rate is ${summary.voiceSuccessRate}%. Monitor closely and consider reducing voice usage until stability improves.`;
    case "watch":
      if (recommendation.recommendationType === "no_change") {
        return `Voice runtime is operating normally with ${summary.totalSignals} signals collected. No strong recommendation signals. Continue monitoring.`;
      }
      return `${recommendation.summary} However, governed apply gate is on ${governedApply.applyDecision} with reason: ${governedApply.reason}. Evidence window is ${summary.totalSignals} signals. Continue observation before policy change.`;
    case "healthy":
    default:
      return `Voice runtime is healthy. Success rate ${summary.voiceSuccessRate}%, fallback rate ${summary.fallbackRate}%, quality score ${summary.avgQualityScore}. No immediate action required.`;
  }
}

function determineSuggestedOperatorAction(
  status: VoiceReviewStatus,
  recommendation: VoicePolicyRecommendation,
  governedApply: VoiceGovernedApplyResult,
  summary: VoiceAdaptiveSignalsSummary,
): string {
  switch (status) {
    case "blocked":
      return "Investigate delivery instability. Check provider health, interruption logic, and recent changes. Do not apply policy changes until runtime recovers.";
    case "degraded":
      return "Monitor closely for 20-50 additional turns. Consider reducing voice usage temporarily. Review admission thresholds and provider configuration.";
    case "watch":
      if (summary.totalSignals < 60) {
        return `Continue observing until ${Math.max(60, summary.totalSignals + 20)}+ signals are collected. Recommendation is on hold pending stronger evidence.`;
      }
      return `Recommendation is on hold (${governedApply.reason}). Review blockers and warnings. If stable for 50+ additional turns, consider manual policy review.`;
    case "healthy":
    default:
      return "No action required. Continue normal monitoring. System is operating within expected parameters.";
  }
}

// ============================================================================
// Core builder function
// ============================================================================

/**
 * Build a voice review packet from aggregated state.
 * Pure function — deterministic, structured, operator-ready.
 */
export function buildVoiceReviewPacket(
  input: BuildVoiceReviewPacketInput,
): VoiceReviewPacket {
  const { summary, recommendation, governedApply } = input;
  const now = Date.now();

  const status = determineReviewStatus(summary, recommendation, governedApply);
  const headline = determineHeadline(status, recommendation);
  const operatorSummary = determineOperatorSummary(status, recommendation, governedApply, summary);
  const suggestedAction = determineSuggestedOperatorAction(status, recommendation, governedApply, summary);

  return {
    generatedAtMs: now,
    status,
    headline,
    operatorSummary,
    metrics: {
      voiceSuccessRate: summary.voiceSuccessRate,
      fallbackRate: summary.fallbackRate,
      interruptionBlockRate: summary.interruptionBlockRate,
      avgQualityScore: summary.avgQualityScore,
      avgLatencyMs: 0, // Not tracked in VoiceAdaptiveSummary v1.0
      totalSignals: summary.totalSignals,
    },
    recommendation: {
      type: recommendation.recommendationType,
      confidence: recommendation.confidence,
      summary: recommendation.summary,
    },
    governance: {
      applyDecision: governedApply.applyDecision,
      reason: governedApply.reason,
      confidence: governedApply.confidence,
      safeApplyMode: governedApply.safeApplyMode,
    },
    blockers: governedApply.blockers,
    warnings: [...governedApply.warnings, ...recommendation.warnings],
    suggestedOperatorAction: suggestedAction,
  };
}

/**
 * Format a voice review packet for human reading.
 * Designed for CLI output, Telegram admin messages, or future dashboards.
 */
export function formatVoiceReviewPacket(packet: VoiceReviewPacket): string {
  return [
    `🎙 Voice Runtime Review`,
    `• status: ${packet.status}`,
    `• headline: ${packet.headline}`,
    `• recommendation: ${packet.recommendation.type}`,
    `• governed apply: ${packet.governance.applyDecision}`,
    `• confidence: ${packet.recommendation.confidence}`,
    `• success: ${packet.metrics.voiceSuccessRate.toFixed(1)}%`,
    `• fallback: ${packet.metrics.fallbackRate.toFixed(1)}%`,
    `• interruption block: ${packet.metrics.interruptionBlockRate.toFixed(1)}%`,
    `• avg quality: ${packet.metrics.avgQualityScore}`,
    `• avg latency: ${packet.metrics.avgLatencyMs.toFixed(0)}ms`,
    `• total signals: ${packet.metrics.totalSignals}`,
    `• operator action: ${packet.suggestedOperatorAction}`,
    `• blockers: ${packet.blockers.length > 0 ? packet.blockers.join(", ") : "(none)"}`,
    `• warnings: ${packet.warnings.length > 0 ? packet.warnings.join(", ") : "(none)"}`,
  ].join("\n");
}
