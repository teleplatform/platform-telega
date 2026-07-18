import type { AutoRouterDecision, ProviderId, ProviderIntent, ProviderCandidate } from "./types.js";
import { detectIntent } from "./intentDetector.js";
import { getProviderCapabilities, getAllProviders, getStableProviders } from "./capabilityRegistry.js";
import { selectBestProvider, rankProviders } from "./scoringEngine.js";
import { getAutoRouterConfig, setAutoRouterConfig } from "./config.js";

const recentDecisions: AutoRouterDecision[] = [];
const MAX_DECISION_HISTORY = 10;

export function getLastDecision(): AutoRouterDecision | null {
  return recentDecisions[recentDecisions.length - 1] ?? null;
}

export async function autoRoute(
  message: string,
  options?: {
    intent?: ProviderIntent;
    selectedProvider?: ProviderId;
    allowExperimental?: boolean;
  },
): Promise<AutoRouterDecision> {
  const config = getAutoRouterConfig();
  const allowExperimental = options?.allowExperimental ?? config.allowExperimental;
  const intent = options?.intent ?? detectIntent(message);

  const allProviders = getAllProviders();
  const candidates: ProviderCandidate[] = [];

  const context = {
    intent,
    health: "healthy" as const,
    latency: "fast" as const,
    recentFailures: 0,
    selectedProvider: options?.selectedProvider,
  };

  const ranked = rankProviders(allProviders, context);

  for (const { entry, score, reasons } of ranked) {
    // Skip disabled
    if (entry.tier === "disabled") continue;

    // Skip experimental unless allowed
    if (entry.tier === "experimental" && !allowExperimental) continue;

    candidates.push({
      provider: entry.providerId,
      displayName: entry.displayName,
      tier: entry.tier,
      capabilities: entry.capabilities,
      score,
      reasons,
    });
  }

  const best = candidates[0] ?? null;

  const decision: AutoRouterDecision = {
    selectedProvider: best?.provider ?? "local",
    selectedModel: best
      ? getDefaultModel(best.provider)
      : "local-demo",
    intent,
    score: best?.score ?? 0,
    reason: best?.reasons ?? ["no candidates available, falling back to local"],
    candidates,
    allowExperimental,
  };

  recentDecisions.push(decision);
  if (recentDecisions.length > MAX_DECISION_HISTORY) {
    recentDecisions.shift();
  }

  console.log("[auto_router:v2:decision]", JSON.stringify({
    intent: decision.intent,
    selected_provider: decision.selectedProvider,
    score: decision.score,
    reasons: decision.reason,
    candidate_scores: candidates.map(c => ({ provider: c.provider, score: c.score, tier: c.tier })),
    allow_experimental: allowExperimental,
  }));

  return decision;
}

function getDefaultModel(provider: ProviderId): string {
  const map: Record<string, string> = {
    openai_api: "gpt-4o-mini",
    deepseek_api: "deepseek-chat",
    qwen_api: "qwen-plus",
    kimi_api: "kimi-k3",
    kimi_local_web_api: "kimi-k3",
    zyloo_api: "zyloo/kimi-k3",
    kimi_free_local: "kimi-k2",
  };
  return map[provider] ?? provider;
}

export function autoRouteSync(
  message: string,
  options?: {
    intent?: ProviderIntent;
  },
): { intent: ProviderIntent } {
  const intent = options?.intent ?? detectIntent(message);
  return { intent };
}

export { getAutoRouterConfig, setAutoRouterConfig } from "./config.js";
export { detectIntent } from "./intentDetector.js";
export { formatAutoRouterConfig } from "./config.js";
