import { getLocalProviderTraceEvents } from"./localEvidence.js";

export interface ModelStats {
  providerId: string;
  requests: number;
  success: number;
  failed: number;
  avgLatencyMs: number;
  fastestMs: number | null;
  slowestMs: number | null;
  lastUsedAt: string | null;
  lastFailureAt: string | null;
  cloudEscapes: number;
  timeouts: number;
}

export interface RuntimeStatsSnapshot {
  models: Record<string, ModelStats>;
  totalRequests: number;
  totalSuccess: number;
  totalFailed: number;
  totalCloudEscapes: number;
  mostUsed: string | null;
  fastest: string | null;
  bestAccuracy: string | null;
}

export function collectRuntimeStats(): RuntimeStatsSnapshot {
  const events = getLocalProviderTraceEvents() as Array<Record<string, unknown>>;
  const modelMap = new Map<string, {
    successes: number[];
    failures: string[];
    latencies: number[];
    lastUsed: string | null;
    lastFailure: string | null;
    cloudEscapes: number;
    timeouts: number;
  }>();

  const extractModelId = (e: Record<string, unknown>): string | null => {
    return (e.modelId as string) || null;
  };

  for (const e of events) {
    const event = e.event as string;
    const modelId = extractModelId(e);
    if (!modelId) continue;

    if (!modelMap.has(modelId)) {
      modelMap.set(modelId, {
        successes: [],
        failures: [],
        latencies: [],
        lastUsed: null,
        lastFailure: null,
        cloudEscapes: 0,
        timeouts: 0,
      });
    }

    const stats = modelMap.get(modelId)!;

    if (event === "local_model_response_started") {
      // count as request
    } else if (event === "local_model_response_completed") {
      stats.successes.push(1);
      stats.latencies.push(e.latencyMs as number || e.lat as number || 0);
      stats.lastUsed = e.timestamp as string;
    } else if (event === "local_model_response_failed") {
      stats.failures.push(e.error as string || "unknown");
      stats.lastFailure = e.timestamp as string;
    } else if (event === "local_failover_model_failed") {
      stats.failures.push(e.error as string || "failover");
      stats.lastFailure = e.timestamp as string;
    } else if (event === "local_failover_model_succeeded") {
      stats.successes.push(1);
      stats.latencies.push(e.latencyMs as number || 0);
      stats.lastUsed = e.timestamp as string;
    } else if (event === "local_cloud_escape_started") {
      stats.cloudEscapes++;
    } else if (event === "local_timeout_triggered") {
      stats.timeouts++;
      stats.failures.push("timeout");
      stats.lastFailure = e.timestamp as string;
    }
  }

  const models: Record<string, ModelStats> = {};

  for (const [providerId, data] of modelMap) {
    const allLatencies = data.latencies.filter((l) => l > 0);
    const avgLatencyMs = allLatencies.length > 0
      ? Math.round(allLatencies.reduce((s, l) => s + l, 0) / allLatencies.length)
      : 0;

    models[providerId] = {
      providerId,
      requests: data.successes.length + data.failures.length,
      success: data.successes.length,
      failed: data.failures.length,
      avgLatencyMs,
      fastestMs: allLatencies.length > 0 ? Math.min(...allLatencies) : null,
      slowestMs: allLatencies.length > 0 ? Math.max(...allLatencies) : null,
      lastUsedAt: data.lastUsed,
      lastFailureAt: data.lastFailure,
      cloudEscapes: data.cloudEscapes,
      timeouts: data.timeouts,
    };
  }

  // Compute aggregate and rankings
  const allModels = Object.values(models);
  const totalRequests = allModels.reduce((s, m) => s + m.requests, 0);
  const totalSuccess = allModels.reduce((s, m) => s + m.success, 0);
  const totalFailed = allModels.reduce((s, m) => s + m.failed, 0);
  const totalCloudEscapes = allModels.reduce((s, m) => s + m.cloudEscapes, 0);

  const byUsage = [...allModels].sort((a, b) => b.requests - a.requests);
  const byLatency = [...allModels].filter((m) => m.avgLatencyMs > 0).sort((a, b) => a.avgLatencyMs - b.avgLatencyMs);
  const byAccuracy = [...allModels].filter((m) => m.requests > 0).sort(
    (a, b) => (b.success / b.requests) - (a.success / a.requests)
  );

  return {
    models,
    totalRequests,
    totalSuccess,
    totalFailed,
    totalCloudEscapes,
    mostUsed: byUsage[0]?.providerId ?? null,
    fastest: byLatency[0]?.providerId ?? null,
    bestAccuracy: byAccuracy[0]?.providerId ?? null,
  };
}
