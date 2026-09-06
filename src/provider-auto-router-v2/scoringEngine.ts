import type { ProviderIntent, ProviderCapability, ProviderId } from "./types.js";
import { getProviderCapabilities, type ProviderCapabilityEntry } from "./capabilityRegistry.js";
import { getAutoRouterConfig } from "./config.js";
import { computeStatsForIntent, readRecentEvidence } from "../provider-evidence/storage.js";

const INTENT_CAPABILITY_MAP: Record<ProviderIntent, ProviderCapability[]> = {
  fast_chat: ["fast"],
  code_small: ["code", "fast"],
  code_large: ["code", "reasoning", "long_context"],
  long_text: ["long_context", "creative"],
  reasoning: ["reasoning", "long_context"],
  creative: ["creative", "reasoning"],
  technical_debug: ["reasoning", "code", "technical_debug"],
  unknown: ["fast"],
};

const TIER_SCORES: Record<string, number> = {
  stable: 40,
  beta: 20,
  experimental: -20,
  disabled: -999,
};

const CAPABILITY_EXACT_MATCH = 30;
const CAPABILITY_PARTIAL_MATCH = 10;

const HEALTHY_SCORE = 20;
const DEGRADED_SCORE = -20;
const DOWN_SCORE = -999;

const FAST_LATENCY = 10;
const SLOW_LATENCY = -10;

const RECENT_FAILURE_PENALTY = -15;

const MANUAL_SELECTOR_BONUS = 100;

const EXPERIMENTAL_PENALTY_NOT_ALLOWED = -50;

// Evidence-based adjustments
const EVIDENCE_HIGH_SUCCESS_BONUS = 15;
const EVIDENCE_LOW_SUCCESS_PENALTY = -20;
const EVIDENCE_INTENT_EXPERT_BONUS = 10;
const EVIDENCE_HIGH_LATENCY_PENALTY = -10;
const EVIDENCE_LOW_LATENCY_BONUS = 5;

interface Context {
  health?: "healthy" | "degraded" | "down" | "unknown";
  latency?: "fast" | "slow" | "unknown";
  recentFailures?: number;
  selectedProvider?: ProviderId;
  intent: ProviderIntent;
}

export function scoreProviderForIntent(
  entry: ProviderCapabilityEntry,
  context: Context,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const config = getAutoRouterConfig();

  // Tier score
  const tierScore = TIER_SCORES[entry.tier] ?? 0;
  score += tierScore;
  reasons.push(`tier:${entry.tier}=${tierScore > 0 ? "+" : ""}${tierScore}`);

  // Disabled check
  if (entry.tier === "disabled") {
    return { score: -999, reasons: ["provider disabled"] };
  }

  // Experimental penalty
  if (entry.tier === "experimental") {
    if (!config.allowExperimental) {
      score += EXPERIMENTAL_PENALTY_NOT_ALLOWED;
      reasons.push(`experimental_not_allowed:${EXPERIMENTAL_PENALTY_NOT_ALLOWED}`);
    } else {
      score += -20;
      reasons.push("experimental_allowed:-20");
    }
  }

  // Capability match
  const requiredCaps = INTENT_CAPABILITY_MAP[context.intent] ?? ["fast"];
  const matchedCaps = requiredCaps.filter(c => entry.capabilities.includes(c));
  const matchRatio = requiredCaps.length > 0 ? matchedCaps.length / requiredCaps.length : 0;

  if (matchRatio >= 1) {
    score += CAPABILITY_EXACT_MATCH;
    reasons.push(`capability_exact:${matchedCaps.join(",")}=+${CAPABILITY_EXACT_MATCH}`);
  } else if (matchRatio > 0) {
    const partialScore = Math.round(CAPABILITY_PARTIAL_MATCH * matchRatio);
    score += partialScore;
    reasons.push(`capability_partial:${matchedCaps.join(",")}=+${partialScore}`);
  } else {
    score += -10;
    reasons.push("capability_mismatch:-10");
  }

  // Health
  const health = context.health ?? "unknown";
  if (health === "healthy") {
    score += HEALTHY_SCORE;
    reasons.push(`health:healthy=+${HEALTHY_SCORE}`);
  } else if (health === "degraded") {
    score += DEGRADED_SCORE;
    reasons.push(`health:degraded=${DEGRADED_SCORE}`);
  } else if (health === "down") {
    return { score: -999, reasons: ["provider down"] };
  }

  // Latency
  const latency = context.latency ?? "unknown";
  if (latency === "fast") {
    score += FAST_LATENCY;
    reasons.push(`latency:fast=+${FAST_LATENCY}`);
  } else if (latency === "slow") {
    score += SLOW_LATENCY;
    reasons.push(`latency:slow=${SLOW_LATENCY}`);
  }

  // Recent failures
  const failures = context.recentFailures ?? 0;
  if (failures > 0) {
    const penalty = failures * RECENT_FAILURE_PENALTY;
    score += penalty;
    reasons.push(`recent_failures:${failures}=${penalty}`);
  }

  // Manual selected provider bonus
  if (context.selectedProvider && context.selectedProvider === entry.providerId) {
    score += MANUAL_SELECTOR_BONUS;
    reasons.push(`manual_selected:+${MANUAL_SELECTOR_BONUS}`);
  }

  // Free preference
  if (config.preferFree && entry.free) {
    score += 15;
    reasons.push("free:+15");
  }

  // === Evidence-based adjustments ===
  const recentEntries = readRecentEvidence(200);
  const intentStats = computeStatsForIntent(recentEntries, entry.providerId, context.intent);

  if (intentStats.totalCalls >= 2) {
    // Success rate bonus/penalty
    if (intentStats.successRate >= 0.95) {
      score += EVIDENCE_HIGH_SUCCESS_BONUS;
      reasons.push(`evidence_high_success:${(intentStats.successRate * 100).toFixed(0)}%=+${EVIDENCE_HIGH_SUCCESS_BONUS}`);
    } else if (intentStats.successRate < 0.7) {
      score += EVIDENCE_LOW_SUCCESS_PENALTY;
      reasons.push(`evidence_low_success:${(intentStats.successRate * 100).toFixed(0)}%=${EVIDENCE_LOW_SUCCESS_PENALTY}`);
    }

    // Latency bonus/penalty based on evidence
    if (intentStats.avgLatencyMs > 0 && intentStats.avgLatencyMs < 2000) {
      score += EVIDENCE_LOW_LATENCY_BONUS;
      reasons.push(`evidence_fast:${intentStats.avgLatencyMs}ms=+${EVIDENCE_LOW_LATENCY_BONUS}`);
    } else if (intentStats.avgLatencyMs > 10000) {
      score += EVIDENCE_HIGH_LATENCY_PENALTY;
      reasons.push(`evidence_slow:${intentStats.avgLatencyMs}ms=${EVIDENCE_HIGH_LATENCY_PENALTY}`);
    }

    // Intent expertise bonus — provider has done well for this specific intent
    const allStats = computeStatsForIntent(recentEntries, entry.providerId, "unknown");
    if (allStats.totalCalls > 0 && intentStats.successRate > allStats.successRate + 0.1) {
      score += EVIDENCE_INTENT_EXPERT_BONUS;
      reasons.push(`evidence_intent_expert:${(intentStats.successRate * 100).toFixed(0)}%>${(allStats.successRate * 100).toFixed(0)}%=+${EVIDENCE_INTENT_EXPERT_BONUS}`);
    }
  }

  return { score, reasons };
}

export function rankProviders(
  providers: ProviderCapabilityEntry[],
  context: Context,
): Array<{ entry: ProviderCapabilityEntry; score: number; reasons: string[] }> {
  const scored = providers.map(entry => {
    const { score, reasons } = scoreProviderForIntent(entry, context);
    return { entry, score, reasons };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

export function selectBestProvider(
  providers: ProviderCapabilityEntry[],
  context: Context,
): { entry: ProviderCapabilityEntry; score: number; reasons: string[] } | null {
  if (providers.length === 0) return null;

  const ranked = rankProviders(providers, context);

  // Filter out down/disabled
  const valid = ranked.filter(r => r.score > -500);
  if (valid.length === 0) return null;

  return valid[0];
}
