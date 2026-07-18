import { appendEvidenceRecord } from "../runtime/evidence/execution-evidence-store.js";

export type ProviderMatrixProvider =
  | "glm_api" | "glm_local_web_api"
  | "kimi_api" | "kimi_local_web_api"
  | "zyloo_api"
  | "mimo_api" | "mimo_browser_discovery";

export interface MatrixEntry {
  provider: ProviderMatrixProvider;
  officialKey: string;
  displayName: string;
  apiBaseUrl: string;
  model: string;
  browserFallback: ProviderMatrixProvider;
}

const MATRIX: Record<string, MatrixEntry> = {
  glm_api: {
    provider: "glm_api",
    officialKey: "GLM_API_KEY",
    displayName: "GLM API",
    apiBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-5-thinking",
    browserFallback: "glm_local_web_api",
  },
  kimi_api: {
    provider: "kimi_api",
    officialKey: "KIMI_API_KEY",
    displayName: "Kimi API",
    apiBaseUrl: "https://api.moonshot.ai/v1",
    model: "kimi-k3",
    browserFallback: "kimi_local_web_api",
  },
  zyloo_api: {
    provider: "zyloo_api",
    officialKey: "ZYLOO_API_KEY",
    displayName: "Zyloo API",
    apiBaseUrl: "https://api.zyloo.io/v1",
    model: "zyloo/kimi-k3",
    browserFallback: "kimi_local_web_api",
  },
  mimo_api: {
    provider: "mimo_api",
    officialKey: "MIMO_API_KEY",
    displayName: "Mimo API",
    apiBaseUrl: "https://api.xiaomimimo.com/v1",
    model: "mimo-v2.5-pro",
    browserFallback: "mimo_browser_discovery",
  },
};

const BROWSER_CHAIN: Record<string, string[]> = {
  glm_local_web_api: ["glm_api", "kimi_local_web_api", "deepseek_web", "local"],
  kimi_local_web_api: ["kimi_api", "glm_local_web_api", "deepseek_web", "local"],
  mimo_browser_discovery: ["mimo_api", "kimi_local_web_api", "deepseek_web", "local"],
};

function recordEvidence(type: string, provider: string, payload: Record<string, unknown>): void {
  appendEvidenceRecord({
    evidence_id: `matrix-${provider}-${type}-${Date.now()}`,
    trace_id: `matrix:${provider}`,
    job_id: "provider_matrix",
    type: type as any,
    timestamp: new Date().toISOString(),
    payload,
  }).catch(() => {});
}

export const ProviderMatrix = {
  resolve(providerId: string): { primary: MatrixEntry | null; browserFallback: MatrixEntry | null; chain: string[] } {
    // Check if it's an official API provider
    const entry = MATRIX[providerId];
    if (entry) {
      const hasKey = !!(process.env[entry.officialKey] || "").trim();
      return {
        primary: entry,
        browserFallback: MATRIX[entry.browserFallback] || null,
        chain: hasKey ? [providerId, entry.browserFallback, ...BROWSER_CHAIN[entry.browserFallback]?.filter(p => p !== providerId) || []] : [entry.browserFallback, ...BROWSER_CHAIN[entry.browserFallback] || []],
      };
    }

    // Check if it's a browser fallback provider
    const chain = BROWSER_CHAIN[providerId];
    if (chain) {
      return {
        primary: null,
        browserFallback: null,
        chain: [providerId, ...chain],
      };
    }

    // Unknown provider — pass through
    return {
      primary: null,
      browserFallback: null,
      chain: [providerId],
    };
  },

  async determineSource(providerId: string): Promise<{
    source: "official_api" | "browser_fallback" | "other";
    executedProvider: string;
    keyPresent: boolean;
  }> {
    const { primary, chain } = ProviderMatrix.resolve(providerId);

    // If this is an official API provider with a key, use it
    if (primary) {
      let key = (process.env[primary.officialKey] || "").trim();
      // Kimi supports both KIMI_API_KEY and MOONSHOT_API_KEY
      if (!key && primary.provider === "kimi_api") {
        key = (process.env.MOONSHOT_API_KEY || "").trim();
      }
      if (key && key.length > 10 && !/[А-Яа-яЁё]/.test(key) && !key.startsWith("ВСТАВЬ") && !key.startsWith("YOUR_")) {
        recordEvidence("provider.official.selected", providerId, {
          provider: primary.provider,
          keyEnv: primary.officialKey,
          apiBaseUrl: primary.apiBaseUrl,
        });
        return { source: "official_api", executedProvider: primary.provider, keyPresent: true };
      }

      // Key missing or placeholder — fallback to browser
      if (primary.browserFallback) {
        recordEvidence("provider.official.failed", providerId, {
          provider: primary.provider,
          reason: "key_missing_or_placeholder",
          browserFallback: primary.browserFallback.provider,
        });
        recordEvidence("provider.browser_fallback.selected", providerId, {
          provider: primary.browserFallback.provider,
          original: primary.provider,
        });
        return { source: "browser_fallback", executedProvider: primary.browserFallback.provider, keyPresent: false };
      }
    }

    // Browser provider or unknown — use chain[0]
    const executed = chain[0] || providerId;
    if (executed !== providerId) {
      recordEvidence("provider.browser_fallback.executed", providerId, {
        provider: executed,
        original: providerId,
      });
    }
    return { source: "browser_fallback", executedProvider: executed, keyPresent: false };
  },

  async resolveChain(providerId: string): Promise<{
    chain: string[];
    authSource: "official_api" | "browser_fallback" | "other";
    primaryProvider: string;
  }> {
    const { primary, chain } = ProviderMatrix.resolve(providerId);
    const source = await ProviderMatrix.determineSource(providerId);

    recordEvidence("provider.auth_source.resolved", providerId, {
      provider: providerId,
      source: source.source,
      primary: primary?.provider || null,
      executed: source.executedProvider,
      chain: chain.join(","),
    });

    return {
      chain,
      authSource: source.source,
      primaryProvider: source.executedProvider,
    };
  },
};
