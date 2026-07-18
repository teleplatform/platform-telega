import { appendEvidenceRecord } from "../runtime/evidence/execution-evidence-store.js";
import { ProviderOps } from "./providerOpsService.js";

export type FailoverProvider = "glm_local_web_api" | "kimi_local_web_api" | "deepseek_web" | "zyloo_api" | "local";

const FALLBACK_CHAINS: Record<string, FailoverProvider[]> = {
  glm_local_web_api: ["kimi_local_web_api", "deepseek_web", "local"],
  kimi_local_web_api: ["glm_local_web_api", "deepseek_web", "local"],
  zyloo_api: ["kimi_local_web_api", "deepseek_web", "local"],
};

const BASE_URL = "http://127.0.0.1:9766";

interface FailoverDecision {
  selectedProvider: string;
  executedProvider: string | null;
  reason: string;
  errorClass: string | null;
  latency: number;
  ok: boolean;
  text?: string;
  error?: string;
  fallbackChain: string[];
  attemptedProviders: string[];
}

function recordEvidence(type: string, provider: string, payload: Record<string, unknown>): void {
  appendEvidenceRecord({
    evidence_id: `failover-${provider}-${type}-${Date.now()}`,
    trace_id: `failover:${provider}`,
    job_id: "failover_policy",
    type: type as any,
    timestamp: new Date().toISOString(),
    payload,
  }).catch(() => {});
}

function classifyError(error: string): string {
  if (!error) return "";
  if (/auth_expired|401|unauthorized|token missing|permission_denied|REASON_ANONYMOUS_REQUIRE_LOGIN/i.test(error)) return "auth_expired";
  if (/timeout|timed out|abort/i.test(error)) return "timeout";
  if (/cooldown/i.test(error)) return "cooldown";
  if (/rate|429|too many/i.test(error)) return "rate_limited";
  if (/network|refused|ECONNREFUSED|econnrefused/i.test(error)) return "network";
  if (/model.*not.*available|permission.*denied/i.test(error)) return "model_unauthorized";
  return "unknown";
}

async function tryProvider(model: string): Promise<{ ok: boolean; latency: number; text?: string; error?: string }> {
  const start = Date.now();
  try {
    const resp = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply exactly: PONG" }],
      }),
      signal: AbortSignal.timeout(30000),
    });
    const latency = Date.now() - start;
    const data = await resp.json().catch(() => ({})) as any;
    if (resp.ok && data?.choices?.[0]?.message?.content) {
      return { ok: true, latency, text: data.choices[0].message.content };
    }
    const err = data?.error?.message || `HTTP ${resp.status}`;
    return { ok: false, latency, error: err };
  } catch (err: any) {
    return { ok: false, latency: Date.now() - start, error: err?.message || "fetch failed" };
  }
}

const MODEL_MAP: Record<string, string> = {
  glm_local_web_api: "glm-5-thinking",
  kimi_local_web_api: "kimi-k3",
  zyloo_api: "zyloo/kimi-k3",
  deepseek_web: "deepseek-chat",
  local: "local-demo",
};

export const FailoverPolicy = {
  async execute(
    selectedProvider: string,
    userLockProvider?: string | null,
  ): Promise<FailoverDecision> {
    const decision: FailoverDecision = {
      selectedProvider,
      executedProvider: null,
      reason: "",
      errorClass: null,
      latency: 0,
      ok: false,
      fallbackChain: FALLBACK_CHAINS[selectedProvider] || [],
      attemptedProviders: [],
    };

    const chain = [selectedProvider, ...decision.fallbackChain];
    const start = Date.now();

    for (const provider of chain) {
      const model = MODEL_MAP[provider];
      if (!model) continue;

      decision.attemptedProviders.push(provider);
      recordEvidence("provider.failover.selected", provider, {
        selected_provider: selectedProvider,
        candidate: provider,
      });

      // Health gate via ProviderOps status check
      const statuses = await ProviderOps.status();
      const status = statuses.find(s => s.provider === provider);

      if (status && status.status === "auth_expired") {
        recordEvidence("provider.failover.skipped_unhealthy", provider, {
          selected_provider: selectedProvider,
          reason: `auth_expired`,
          error_class: "auth_expired",
        });
        continue;
      }

      if (status && status.status === "down") {
        recordEvidence("provider.failover.skipped_unhealthy", provider, {
          selected_provider: selectedProvider,
          reason: "down",
          error_class: "network",
        });
        continue;
      }

      const result = await tryProvider(model);
      if (result.ok) {
        decision.executedProvider = provider;
        decision.reason = provider === selectedProvider ? "primary" : `fallback_from_${selectedProvider}`;
        decision.ok = true;
        decision.text = result.text;
        decision.latency = result.latency;

        // If provider drifted from user lock, record override
        if (userLockProvider && provider !== userLockProvider) {
          recordEvidence("provider.lock.override", provider, {
            user_locked: userLockProvider,
            executed: provider,
            reason: `${userLockProvider} was unhealthy`,
          });
        }

        recordEvidence("provider.failover.executed", provider, {
          selected_provider: selectedProvider,
          reason: decision.reason,
          latency: result.latency,
        });

        decision.errorClass = null;
        return decision;
      }

      const errorClass = classifyError(result.error || "");
      recordEvidence("provider.failover.skipped_unhealthy", provider, {
        selected_provider: selectedProvider,
        reason: result.error,
        error_class: errorClass,
      });

      // For auth_expired, stop trying further providers
      if (errorClass === "auth_expired") {
        recordEvidence("provider.failover.exhausted", provider, {
          selected_provider: selectedProvider,
          reason: "all_providers_auth_expired",
          attempted: chain.join(","),
        });
        decision.error = `[auth_expired] ${result.error}`;
        decision.errorClass = "auth_expired";
        decision.latency = Date.now() - start;
        return decision;
      }
    }

    // All providers exhausted
    decision.executedProvider = null;
    decision.error = "All providers failed";
    decision.errorClass = "exhausted";
    decision.latency = Date.now() - start;
    recordEvidence("provider.failover.exhausted", selectedProvider, {
      selected_provider: selectedProvider,
      reason: "fallback_chain_exhausted",
      attempted: chain.join(","),
    });

    return decision;
  },
};
