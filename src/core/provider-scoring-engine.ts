/**
 * TGP-17B — Provider Scoring Engine
 *
 * Deterministic, explainable provider scoring layer.
 * Ranks eligible providers using health metrics and static policy configuration.
 *
 * Does NOT:
 * - Modify Health Runtime (read-only consumer)
 * - Revive providers excluded by Eligibility
 * - Include capability matching, quality scoring, ML, or learning
 * - Analyze prompts or use embeddings
 */

import type { ProviderHealthStatus } from "./provider-health-runtime.js";
import { getSnapshot, isProviderEligible, getAllSnapshots } from "./provider-health-runtime.js";
import { appendEvidenceRecord } from "../runtime/evidence/execution-evidence-store.js";

// ─── Configuration ────────────────────────────────────────────────────────────

export interface ProviderScoringConfig {
  availabilityWeight: number;
  latencyWeight: number;
  failureRateWeight: number;
  priorityWeight: number;
  costWeight: number;
  latencyFloorMs: number;
  latencyCeilingMs: number;
  maxResults: number;
}

export const DEFAULT_SCORING_CONFIG: ProviderScoringConfig = {
  availabilityWeight: 0.35,
  latencyWeight: 0.25,
  failureRateWeight: 0.20,
  priorityWeight: 0.10,
  costWeight: 0.10,
  latencyFloorMs: 100,
  latencyCeilingMs: 5000,
  maxResults: 10,
};

// ─── Provider Static Policy ───────────────────────────────────────────────────

export type CostClass = "free" | "cheap" | "standard" | "premium";

export interface ProviderPolicy {
  providerId: string;
  priority: number;
  costClass: CostClass;
}

const DEFAULT_PROVIDER_POLICIES: Record<string, ProviderPolicy> = {
  local:                  { providerId: "local",                  priority: 5, costClass: "free" },
  kimi_local_web_api:     { providerId: "kimi_local_web_api",     priority: 6, costClass: "free" },
  glm_local_web_api:      { providerId: "glm_local_web_api",      priority: 5, costClass: "free" },
  mimo_browser_discovery: { providerId: "mimo_browser_discovery", priority: 4, costClass: "free" },
  deepseek_web:           { providerId: "deepseek_web",           priority: 7, costClass: "cheap" },
  qwen_web:               { providerId: "qwen_web",               priority: 6, costClass: "cheap" },
  deepseek_api:           { providerId: "deepseek_api",           priority: 7, costClass: "cheap" },
  qwen_api:               { providerId: "qwen_api",               priority: 6, costClass: "cheap" },
  kimi_api:               { providerId: "kimi_api",               priority: 8, costClass: "cheap" },
  zyloo_api:              { providerId: "zyloo_api",              priority: 7, costClass: "cheap" },
  glm_api:                { providerId: "glm_api",                priority: 6, costClass: "cheap" },
  mimo_api:               { providerId: "mimo_api",               priority: 5, costClass: "cheap" },
  openai_api:             { providerId: "openai_api",             priority: 9, costClass: "premium" },
  openai_web:             { providerId: "openai_web",             priority: 8, costClass: "premium" },
  chatgpt_web:            { providerId: "chatgpt_web",            priority: 8, costClass: "premium" },
  gemini_web:             { providerId: "gemini_web",             priority: 8, costClass: "premium" },
  grok_web:               { providerId: "grok_web",               priority: 7, costClass: "premium" },
  kimi_web:               { providerId: "kimi_web",               priority: 8, costClass: "premium" },
};

let providerPolicies = { ...DEFAULT_PROVIDER_POLICIES };

export function setProviderPolicies(policies: Record<string, ProviderPolicy>): void {
  providerPolicies = { ...DEFAULT_PROVIDER_POLICIES, ...policies };
}

export function resetProviderPolicies(): void {
  providerPolicies = { ...DEFAULT_PROVIDER_POLICIES };
}

// ─── Score Dimension Normalizers ───────────────────────────────────────────────

function normalizeAvailability(rate: number): number {
  return Math.max(0, Math.min(1, rate));
}

function normalizeLatency(latencyMs: number, config: ProviderScoringConfig): number {
  if (latencyMs <= 0) return 1.0;
  if (latencyMs <= config.latencyFloorMs) return 1.0;
  if (latencyMs >= config.latencyCeilingMs) return 0.0;
  return 1.0 - (latencyMs - config.latencyFloorMs) / (config.latencyCeilingMs - config.latencyFloorMs);
}

function normalizeFailureRate(rate: number): number {
  return Math.max(0, 1.0 - rate);
}

function normalizePriority(priority: number): number {
  return Math.max(0, Math.min(1, priority / 10));
}

function normalizeCost(costClass: CostClass): number {
  switch (costClass) {
    case "free": return 1.0;
    case "cheap": return 0.75;
    case "standard": return 0.5;
    case "premium": return 0.25;
  }
}

// ─── Score Breakdown ──────────────────────────────────────────────────────────

export interface ProviderScoreBreakdown {
  availability: number;
  latency: number;
  failureRate: number;
  priority: number;
  cost: number;
}

// ─── Ranked Provider ──────────────────────────────────────────────────────────

export interface RankedProvider {
  providerId: string;
  score: number;
  breakdown: ProviderScoreBreakdown;
  rankingPosition: number;
  healthStatus: ProviderHealthStatus;
  eligible: boolean;
}

// ─── Ranking Result ───────────────────────────────────────────────────────────

export interface ProviderRankingResult {
  ranked: RankedProvider[];
  config: ProviderScoringConfig;
  timestamp: number;
  totalEligible: number;
  totalExcluded: number;
}

// ─── Scoring Engine ───────────────────────────────────────────────────────────

let currentConfig: ProviderScoringConfig = { ...DEFAULT_SCORING_CONFIG };

export function setScoringConfig(config: Partial<ProviderScoringConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

export function getScoringConfig(): ProviderScoringConfig {
  return { ...currentConfig };
}

export function resetScoringConfig(): void {
  currentConfig = { ...DEFAULT_SCORING_CONFIG };
}

export function scoreProvider(providerId: string): RankedProvider | null {
  const eligible = isProviderEligible(providerId);
  const snapshot = getSnapshot(providerId);
  const policy = providerPolicies[providerId] || {
    providerId,
    priority: 5,
    costClass: "standard" as CostClass,
  };

  const availability = normalizeAvailability(snapshot.availabilityRate);
  const latency = normalizeLatency(snapshot.averageLatencyMs, currentConfig);
  const failureRate = normalizeFailureRate(snapshot.rollingFailureRate);
  const priority = normalizePriority(policy.priority);
  const cost = normalizeCost(policy.costClass);

  const breakdown: ProviderScoreBreakdown = {
    availability: availability * currentConfig.availabilityWeight,
    latency: latency * currentConfig.latencyWeight,
    failureRate: failureRate * currentConfig.failureRateWeight,
    priority: priority * currentConfig.priorityWeight,
    cost: cost * currentConfig.costWeight,
  };

  const score = breakdown.availability + breakdown.latency + breakdown.failureRate
    + breakdown.priority + breakdown.cost;

  return {
    providerId,
    score: Math.round(score * 10000) / 10000,
    breakdown,
    rankingPosition: 0,
    healthStatus: snapshot.status,
    eligible,
  };
}

export function rankProviders(providerIds: string[]): ProviderRankingResult {
  const scored: RankedProvider[] = [];
  let totalExcluded = 0;

  for (const id of providerIds) {
    const result = scoreProvider(id);
    if (result && result.eligible) {
      scored.push(result);
    } else {
      totalExcluded++;
    }
  }

  scored.sort((a, b) => b.score - a.score || a.providerId.localeCompare(b.providerId));

  for (let i = 0; i < scored.length; i++) {
    scored[i].rankingPosition = i + 1;
  }

  const limited = scored.slice(0, currentConfig.maxResults);

  const result: ProviderRankingResult = {
    ranked: limited,
    config: { ...currentConfig },
    timestamp: Date.now(),
    totalEligible: scored.length,
    totalExcluded,
  };

  emitRankingEvidence(result);
  return result;
}

export function selectBestProvider(providerIds: string[]): RankedProvider | null {
  const result = rankProviders(providerIds);
  return result.ranked.length > 0 ? result.ranked[0] : null;
}

export function getRankingDiagnostics(): ProviderRankingResult {
  const allSnapshots = getAllSnapshots();
  const providerIds = allSnapshots.map(s => s.providerId);
  return rankProviders(providerIds);
}

// ─── Evidence ─────────────────────────────────────────────────────────────────

function emitRankingEvidence(result: ProviderRankingResult): void {
  if (result.ranked.length === 0) return;
  const best = result.ranked[0];
  appendEvidenceRecord({
    evidence_id: `provider.scored-${Date.now()}`,
    trace_id: "provider_scoring",
    job_id: "scoring_ranking",
    type: "provider.scored" as any,
    timestamp: new Date().toISOString(),
    payload: {
      providerId: best.providerId,
      score: best.score,
      breakdown: best.breakdown,
      rankingPosition: best.rankingPosition,
      totalEligible: result.totalEligible,
      totalExcluded: result.totalExcluded,
    },
  }).catch(() => {});
}
