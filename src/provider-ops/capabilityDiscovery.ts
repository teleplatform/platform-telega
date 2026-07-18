import { appendEvidenceRecord } from "../runtime/evidence/execution-evidence-store.js";

export interface DiscoveredModel {
  upstreamId: string;
  canonicalId: string;
  isLegacy: boolean;
}

export interface DiscoveredCapabilities {
  vision: boolean;
  toolCalling: boolean;
  structuredOutput: boolean;
  reasoning: boolean;
  streaming: boolean;
}

export interface DiscoveredLimits {
  contextWindow: number;
  maxOutputTokens: number;
}

export interface CapabilityDiscoveryResult {
  providerId: string;
  availableModels: DiscoveredModel[];
  capabilities: DiscoveredCapabilities;
  limits: DiscoveredLimits;
  discoveredAt: number;
  upstreamModelIds: Record<string, string>;
}

const KIMI_K3_CANONICAL_MAP: Record<string, string> = {
  "kimi-k3": "kimi-k3",
  "moonshot-v1-auto": "kimi-k3",
  "moonshot-v1-128k": "kimi-k3",
  "kimi-k2.5": "kimi-k2.5",
};

const ZYLOO_CANONICAL_MAP: Record<string, string> = {
  "zyloo/kimi-k3": "kimi-k3",
  "kimi-k3": "kimi-k3",
};

const KIMI_K3_DEFAULT_RESULT: CapabilityDiscoveryResult = {
  providerId: "kimi",
  availableModels: [
    { upstreamId: "kimi-k3", canonicalId: "kimi-k3", isLegacy: false },
    { upstreamId: "kimi-k2.5", canonicalId: "kimi-k2.5", isLegacy: true },
  ],
  capabilities: {
    vision: true,
    toolCalling: true,
    structuredOutput: true,
    reasoning: true,
    streaming: true,
  },
  limits: {
    contextWindow: 1_000_000,
    maxOutputTokens: 32_768,
  },
  discoveredAt: 0,
  upstreamModelIds: { "kimi-k3": "kimi-k3" },
};

function recordEvidence(type: string, providerId: string, payload: Record<string, unknown>): void {
  appendEvidenceRecord({
    evidence_id: `cap-discovery-${providerId}-${type}-${Date.now()}`,
    trace_id: `cap-discovery:${providerId}`,
    job_id: "capability_discovery",
    type: type as any,
    timestamp: new Date().toISOString(),
    payload: { providerId, ...payload },
  }).catch(() => {});
}

function normalizeKimiUpstreamId(rawId: string): string {
  const normalized = rawId.trim().toLowerCase();
  return KIMI_K3_CANONICAL_MAP[normalized] || normalized;
}

async function discoverKimiWebModels(
  bridgeBase: string
): Promise<{ models: DiscoveredModel[]; raw: Record<string, string> }> {
  try {
    const resp = await fetch(`${bridgeBase}/v1/models`, {
      method: "GET",
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return { models: KIMI_K3_DEFAULT_RESULT.availableModels, raw: {} };
    const data = await resp.json().catch(() => ({})) as any;
    const modelList = data?.data || [];
    const raw: Record<string, string> = {};
    const models: DiscoveredModel[] = [];

    for (const m of modelList) {
      const upstreamId = m.id || m.model || "";
      if (!upstreamId) continue;
      const canonicalId = normalizeKimiUpstreamId(upstreamId);
      raw[canonicalId] = upstreamId;
      models.push({
        upstreamId,
        canonicalId,
        isLegacy: (KIMI_K3_DEFAULT_RESULT.availableModels[1].upstreamId === canonicalId),
      });
    }

    if (models.length === 0) {
      return { models: KIMI_K3_DEFAULT_RESULT.availableModels, raw };
    }
    return { models, raw };
  } catch {
    return { models: KIMI_K3_DEFAULT_RESULT.availableModels, raw: {} };
  }
}

const discoveryCache = new Map<string, CapabilityDiscoveryResult>();

export const CapabilityDiscovery = {
  async discover(providerId: "kimi_api" | "kimi_local_web_api" | "zyloo_api"): Promise<CapabilityDiscoveryResult> {
    const cached = discoveryCache.get(providerId);
    if (cached && Date.now() - cached.discoveredAt < 30 * 60 * 1000) {
      return cached;
    }

    recordEvidence("discovery.started", providerId, {});

    let result: CapabilityDiscoveryResult;

    if (providerId === "kimi_local_web_api") {
      const bridgeBase = process.env.KIMI_LOCAL_WEB_API_BASE_URL || "http://127.0.0.1:9766";
      const { models, raw } = await discoverKimiWebModels(bridgeBase);
      result = {
        providerId,
        availableModels: models,
        capabilities: KIMI_K3_DEFAULT_RESULT.capabilities,
        limits: KIMI_K3_DEFAULT_RESULT.limits,
        discoveredAt: Date.now(),
        upstreamModelIds: raw,
      };
    } else if (providerId === "zyloo_api") {
      result = {
        providerId,
        availableModels: [
          { upstreamId: "zyloo/kimi-k3", canonicalId: "kimi-k3", isLegacy: false },
        ],
        capabilities: {
          vision: true,
          toolCalling: true,
          structuredOutput: true,
          reasoning: true,
          streaming: true,
        },
        limits: {
          contextWindow: 1_000_000,
          maxOutputTokens: 32_768,
        },
        discoveredAt: Date.now(),
        upstreamModelIds: { "kimi-k3": "zyloo/kimi-k3" },
      };
    } else {
      result = {
        ...KIMI_K3_DEFAULT_RESULT,
        providerId,
        discoveredAt: Date.now(),
      };
    }

    discoveryCache.set(providerId, result);

    recordEvidence("discovery.completed", providerId, {
      modelCount: result.availableModels.length,
      models: result.availableModels.map(m => m.canonicalId),
      upstreamIds: result.upstreamModelIds,
      capabilities: result.capabilities,
      limits: result.limits,
    });

    return result;
  },

  normalizeUpstreamId(rawId: string): string {
    return normalizeKimiUpstreamId(rawId);
  },

  isKimiK3Available(result: CapabilityDiscoveryResult): boolean {
    return result.availableModels.some(m => m.canonicalId === "kimi-k3" && !m.isLegacy);
  },

  getLegacyFallback(result: CapabilityDiscoveryResult): DiscoveredModel | undefined {
    return result.availableModels.find(m => m.isLegacy);
  },

  getCached(providerId: string): CapabilityDiscoveryResult | undefined {
    return discoveryCache.get(providerId);
  },

  invalidateCache(providerId: string): void {
    discoveryCache.delete(providerId);
  },
};
