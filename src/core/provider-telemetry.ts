import type { ProviderId } from "./provider-resolution.js";

export type ProviderExecutionMetric = {
  traceId: string;

  provider_requested: ProviderId;
  provider_primary: ProviderId;
  provider_final: ProviderId;

  model: string;

  success: boolean;
  error_type?: "auth" | "network" | "rate_limit" | "network_quota" | "quota_exhausted" | "invalid_request" | "unknown" | "budget";

  latency_ms: number;

  fallback_used: boolean;
  fallback_chain?: ProviderId[];

  timestamp: number;
};

export type ProviderHealth = {
  provider: ProviderId;

  success_rate: number;
  error_rate: number;

  avg_latency_ms: number;

  fallback_rate: number;

  total_calls: number;
  last_updated: number;
};

const MAX_METRICS = 1000;
const metrics: ProviderExecutionMetric[] = [];

export function recordMetric(metric: ProviderExecutionMetric): void {
  metrics.push(metric);
  
  // Ring buffer - keep last N
  if (metrics.length > MAX_METRICS) {
    metrics.shift();
  }
}

export function getMetrics(): ProviderExecutionMetric[] {
  return [...metrics];
}

export function getMetricsForProvider(provider: ProviderId): ProviderExecutionMetric[] {
  return metrics.filter(m => m.provider_primary === provider || m.provider_final === provider);
}

export function getProviderHealth(provider: ProviderId): ProviderHealth {
  const providerMetrics = getMetricsForProvider(provider);
  
  if (providerMetrics.length === 0) {
    return {
      provider,
      success_rate: 1.0,
      error_rate: 0,
      avg_latency_ms: 0,
      fallback_rate: 0,
      total_calls: 0,
      last_updated: Date.now(),
    };
  }

  const total = providerMetrics.length;
  const successes = providerMetrics.filter(m => m.success).length;
  const fallbacks = providerMetrics.filter(m => m.fallback_used).length;
  
  const totalLatency = providerMetrics.reduce((sum, m) => sum + m.latency_ms, 0);
  const avgLatency = totalLatency / total;

  return {
    provider,
    success_rate: successes / total,
    error_rate: (total - successes) / total,
    avg_latency_ms: avgLatency,
    fallback_rate: fallbacks / total,
    total_calls: total,
    last_updated: Date.now(),
  };
}

export function getAllProviderHealth(): ProviderHealth[] {
  const providers: ProviderId[] = ["local", "openai_api", "deepseek_api", "qwen_api", "chatgpt_web", "qwen_web", "deepseek_web"];
  return providers.map(p => getProviderHealth(p));
}

export function getProviderHealthSnapshot(): ProviderHealth[] {
  return getAllProviderHealth();
}

export function shouldPreferProvider(primary: ProviderId, candidates: ProviderId[]): { primary: ProviderId; candidates: ProviderId[] } {
  // Get health for all candidates
  const healthScores = candidates.map(p => ({
    provider: p,
    health: getProviderHealth(p),
  }));

  // Sort by success rate (descending), then by latency (ascending)
  healthScores.sort((a, b) => {
    // Higher success rate is better
    if (Math.abs(a.health.success_rate - b.health.success_rate) > 0.1) {
      return b.health.success_rate - a.health.success_rate;
    }
    // Lower latency is better
    return a.health.avg_latency_ms - b.health.avg_latency_ms;
  });

  // If primary has very low success rate (< 50%), prefer the best candidate
  const primaryHealth = getProviderHealth(primary);
  if (primaryHealth.success_rate < 0.5 && healthScores.length > 0) {
    return {
      primary: healthScores[0].provider,
      candidates: [primary, ...healthScores.map(h => h.provider).filter(p => p !== healthScores[0].provider)],
    };
  }

  return { primary, candidates };
}

export function clearMetrics(): void {
  metrics.length = 0;
}