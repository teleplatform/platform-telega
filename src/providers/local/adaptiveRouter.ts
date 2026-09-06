import { collectRuntimeStats } from"./runtimeStats.js";
import { writeLocalProviderEvidence } from"./localEvidence.js";
import { LOCAL_MODELS, LocalModelEntry } from"./localModels.js";
import { getOutcomeScoreForModel } from"./outcomeFeedback.js";
import { getResourceSnapshot, getResourceScoreForModel } from"./resourceMonitor.js";
import type { ResourceSnapshot } from"./resourceMonitor.js";

export interface ScoredModel {
  modelId: string;
  modelName: string;
  score: number;
  successRate: number;
  latencyScore: number;
  usageConfidence: number;
  recentHealth: number;
  outcomeScore: number;
  resourceScore: number;
  avgLatencyMs: number;
  requests: number;
}

export interface IntentRanking {
  intent: string;
  label: string;
  rankings: ScoredModel[];
  best: ScoredModel | null;
  fallbackChain: string[];
}

const INTENT_LABELS: Record<string, string> = {
  code: "Code",
  chat: "Chat",
  summary: "Summary",
  translation: "Translation",
  vision: "Vision",
  reasoning: "Reasoning",
};

const INTENT_MODEL_WEIGHTS: Record<string, { latencyWeight: number; minUsage: number }> = {
  chat: { latencyWeight: 0.40, minUsage: 1 },
  code: { latencyWeight: 0.25, minUsage: 1 },
  summary: { latencyWeight: 0.35, minUsage: 1 },
  translation: { latencyWeight: 0.30, minUsage: 1 },
  vision: { latencyWeight: 0.20, minUsage: 1 },
  reasoning: { latencyWeight: 0.15, minUsage: 1 },
};

function computeLatencyScore(avgLatencyMs: number, latencyWeight: number): number {
  if (avgLatencyMs === 0) return 0;
  // Score decreases as latency increases; 1s = 100, 10s = 50, 30s = 20, 60s = 10
  const score = Math.max(0, 100 - (avgLatencyMs / 1000) * 3);
  return Math.round(score);
}

function computeUsageConfidence(requests: number): number {
  if (requests === 0) return 0;
  if (requests >= 500) return 100;
  if (requests >= 100) return 90;
  if (requests >= 50) return 80;
  if (requests >= 20) return 70;
  if (requests >= 10) return 60;
  if (requests >= 5) return 50;
  if (requests >= 2) return 40;
  return 30;
}

function computeRecentHealth(failures: number, requests: number): number {
  if (requests === 0) return 50;
  const rate = failures / requests;
  if (rate === 0) return 100;
  if (rate < 0.05) return 95;
  if (rate < 0.10) return 85;
  if (rate < 0.20) return 70;
  if (rate < 0.35) return 50;
  return Math.max(0, 100 - rate * 100);
}

function computeScore(
  modelId: string,
  successRate: number,
  avgLatencyMs: number,
  requests: number,
  failures: number,
  latencyWeight: number,
  resourceSnapshot?: ResourceSnapshot
): ScoredModel {
  const latencyScore = computeLatencyScore(avgLatencyMs, latencyWeight);
  const usageConfidence = computeUsageConfidence(requests);
  const recentHealth = computeRecentHealth(failures, requests);
  const outcomeScore = getOutcomeScoreForModel(modelId);
  const resourceScore = resourceSnapshot ? getResourceScoreForModel(modelId, resourceSnapshot) : 50;
  const entry = LOCAL_MODELS[modelId] || LOCAL_MODELS[modelId.replace("local:", "")];

  const score = Math.round(
    successRate * 0.25 +
    latencyScore * 0.15 +
    usageConfidence * 0.10 +
    recentHealth * 0.10 +
    outcomeScore * 0.25 +
    resourceScore * 0.15
  );

  return {
    modelId,
    modelName: entry?.name || modelId,
    score,
    successRate,
    latencyScore,
    usageConfidence,
    recentHealth,
    outcomeScore,
    resourceScore,
    avgLatencyMs,
    requests,
  };
}

export async function rankModelsForIntent(intent: string): Promise<IntentRanking> {
  const stats = collectRuntimeStats();
  const weights = INTENT_MODEL_WEIGHTS[intent] || { latencyWeight: 0.30, minUsage: 1 };
  const scored: ScoredModel[] = [];
  const resourceSnapshot = await getResourceSnapshot().catch(() => undefined);
  writeLocalProviderEvidence("resource_snapshot_taken", "system", "System", "ollama", {
    memoryFreeGb: resourceSnapshot?.memoryFreeGb,
    pressure: resourceSnapshot?.memoryPressure,
  });

  for (const [modelId, modelStats] of Object.entries(stats.models)) {
    const entry = LOCAL_MODELS[modelId] || LOCAL_MODELS[modelId.replace("local:", "")];
    if (!entry) continue;

    const requests = modelStats.requests;
    if (requests < weights.minUsage) {
      // Still include with minimal data
    }

    const successRate = requests > 0 ? modelStats.success / requests : 0;
    const scoredModel = computeScore(
      modelId,
      successRate,
      modelStats.avgLatencyMs,
      requests,
      modelStats.failed,
      weights.latencyWeight,
      resourceSnapshot
    );
    scored.push(scoredModel);
  }

  // Add untested models with default scores
  for (const [id, entry] of Object.entries(LOCAL_MODELS)) {
    if (!scored.some((s) => s.modelId === id || s.modelId === entry.id)) {
      scored.push({
        modelId: id,
        modelName: entry.name,
        score: 50,
        successRate: 0,
        latencyScore: 50,
        usageConfidence: 0,
        recentHealth: 50,
        outcomeScore: 50,
        resourceScore: 50,
        avgLatencyMs: 0,
        requests: 0,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return {
    intent,
    label: INTENT_LABELS[intent] || intent,
    rankings: scored,
    best: scored[0] || null,
    fallbackChain: scored.map((s) => s.modelId),
  };
}

export async function selectBestModelForIntent(intent: string): Promise<{
  modelId: string;
  modelName: string;
  score: number;
  fallbackChain: string[];
}> {
  const ranking = await rankModelsForIntent(intent);
  const best = ranking.best;

  if (!best) {
    // Fallback to static rules
    const { selectLocalModel } = require("./localSmartSelector.js");
    const chain = selectLocalModel(intent);
    return {
      modelId: chain[0],
      modelName: LOCAL_MODELS[chain[0]]?.name || chain[0],
      score: 0,
      fallbackChain: chain,
    };
  }

  writeLocalProviderEvidence("adaptive_router_selected", best.modelId, best.modelName, "ollama", {
    intent,
    score: best.score,
    chain: ranking.fallbackChain.slice(0, 3).join(","),
  });

  return {
    modelId: best.modelId,
    modelName: best.modelName,
    score: best.score,
    fallbackChain: ranking.fallbackChain,
  };
}

export async function getAllIntentRankings(): Promise<IntentRanking[]> {
  const rankings = await Promise.all(
    Object.keys(INTENT_LABELS).map((intent) => rankModelsForIntent(intent))
  );
  return rankings;
}
