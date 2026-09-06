import { collectRuntimeStats, ModelStats } from"./runtimeStats.js";
import { LOCAL_MODELS } from"./localModels.js";
import { getAllIntentRankings, IntentRanking } from"./adaptiveRouter.js";
import { getAllModelOutcomeStats, getBestOutcomeModel } from"./outcomeFeedback.js";

export interface DashboardCard {
  modelName: string;
  modelId: string;
  stats: ModelStats | null;
  status: "active" | "untested" | "no_data";
  accuracy: number;
  avgLatencyFormatted: string;
}

export interface RuntimeDashboard {
  cards: DashboardCard[];
  rankings: {
    mostUsed: { id: string; name: string } | null;
    fastest: { id: string; name: string; latencyMs: number } | null;
    bestAccuracy: { id: string; name: string; accuracy: number } | null;
    worstAccuracy: { id: string; name: string; accuracy: number } | null;
    bestOutcome: { id: string; name: string; score: number } | null;
    lowestRetry: { id: string; name: string; retries: number } | null;
    lowestCorrection: { id: string; name: string; corrections: number } | null;
  };
  intentRankings: IntentRanking[];
  totals: {
    requests: number;
    success: number;
    failed: number;
    cloudEscapes: number;
  };
  observedAt: string;
}

export async function buildDashboard(): Promise<RuntimeDashboard> {
  const stats = collectRuntimeStats();
  const cards: DashboardCard[] = [];

  for (const [id, entry] of Object.entries(LOCAL_MODELS)) {
    const modelStats = stats.models[id] || stats.models[entry.id] || null;
    const accuracy = modelStats && modelStats.requests > 0
      ? Math.round((modelStats.success / modelStats.requests) * 100)
      : 0;

    let status: DashboardCard["status"] = "no_data";
    if (modelStats) {
      status = modelStats.requests > 0 ? "active" : "no_data";
    }

    const avgLatencyFormatted = modelStats?.avgLatencyMs
      ? modelStats.avgLatencyMs >= 1000
        ? `${(modelStats.avgLatencyMs / 1000).toFixed(1)}s`
        : `${modelStats.avgLatencyMs}ms`
      : "—";

    cards.push({
      modelName: entry.name,
      modelId: id,
      stats: modelStats,
      status,
      accuracy,
      avgLatencyFormatted,
    });
  }

  // Rankings
  const allWithData = cards.filter((c) => c.stats && c.stats.requests > 0);
  const sortedByUsage = [...allWithData].sort((a, b) => (b.stats?.requests || 0) - (a.stats?.requests || 0));
  const sortedByLatency = [...allWithData].filter((c) => c.stats!.avgLatencyMs > 0).sort((a, b) => a.stats!.avgLatencyMs - b.stats!.avgLatencyMs);
  const sortedByAccuracy = [...allWithData].sort((a, b) => b.accuracy - a.accuracy);

  // Outcome rankings
  const outcomeStats = getAllModelOutcomeStats();
  const outcomeRanked = [...outcomeStats.values()].sort((a, b) => b.outcomeScore - a.outcomeScore);
  const retryRanked = [...outcomeStats.values()].filter((s) => s.totalOutcomes > 0).sort((a, b) => a.retries - b.retries);
  const correctionRanked = [...outcomeStats.values()].filter((s) => s.totalOutcomes > 0).sort((a, b) => a.corrections - b.corrections);

  const lookupName = (id: string) => LOCAL_MODELS[id]?.name || id;

  return {
    cards,
    rankings: {
      mostUsed: sortedByUsage[0] ? { id: sortedByUsage[0].modelId, name: sortedByUsage[0].modelName } : null,
      fastest: sortedByLatency[0]
        ? { id: sortedByLatency[0].modelId, name: sortedByLatency[0].modelName, latencyMs: sortedByLatency[0].stats!.avgLatencyMs }
        : null,
      bestAccuracy: sortedByAccuracy[0]
        ? { id: sortedByAccuracy[0].modelId, name: sortedByAccuracy[0].modelName, accuracy: sortedByAccuracy[0].accuracy }
        : null,
      worstAccuracy: sortedByAccuracy[sortedByAccuracy.length - 1]
        ? { id: sortedByAccuracy[sortedByAccuracy.length - 1].modelId, name: sortedByAccuracy[sortedByAccuracy.length - 1].modelName, accuracy: sortedByAccuracy[sortedByAccuracy.length - 1].accuracy }
        : null,
      bestOutcome: outcomeRanked[0] ? { id: outcomeRanked[0].modelId, name: outcomeRanked[0].modelName, score: outcomeRanked[0].outcomeScore } : null,
      lowestRetry: retryRanked[0] ? { id: retryRanked[0].modelId, name: retryRanked[0].modelName, retries: retryRanked[0].retries } : null,
      lowestCorrection: correctionRanked[0] ? { id: correctionRanked[0].modelId, name: correctionRanked[0].modelName, corrections: correctionRanked[0].corrections } : null,
    },
    intentRankings: await getAllIntentRankings(),
    totals: {
      requests: stats.totalRequests,
      success: stats.totalSuccess,
      failed: stats.totalFailed,
      cloudEscapes: stats.totalCloudEscapes,
    },
    observedAt: new Date().toISOString(),
  };
}
