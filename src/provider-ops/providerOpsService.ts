import { appendEvidenceRecord } from "../runtime/evidence/execution-evidence-store.js";
import { fileURLToPath } from "url";
import path from "path";
import { AuthScheduler } from "./authScheduler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type ProviderOpsStatus = "healthy" | "auth_expired" | "degraded" | "down" | "unknown";
export type ProviderOpsProvider = "glm_local_web_api" | "kimi_local_web_api";

export interface ProviderOpsRecord {
  provider: ProviderOpsProvider;
  displayName: string;
  status: ProviderOpsStatus;
  lastRefresh: number | null;
  lastSuccess: number | null;
  lastError: string | null;
  latency: number;
  errorClass: string | null;
  model: string;
  evidencePath: string;
  tokenExpiresIn: number | null;
  nextRefresh: number | null;
  refreshMode: string | null;
}

const BASE_URL = "http://127.0.0.1:9766";
const EVIDENCE_PATH = "./tmp/provider-ops-events.jsonl";

const records = new Map<ProviderOpsProvider, ProviderOpsRecord>();

function initDefaults(): void {
  const defaults: ProviderOpsRecord[] = [
    {
      provider: "glm_local_web_api",
      displayName: "GLM Local Web API",
      status: "unknown",
      lastRefresh: null,
      lastSuccess: null,
      lastError: null,
      latency: 0,
      errorClass: null,
      model: "glm-5-thinking",
      evidencePath: EVIDENCE_PATH,
      tokenExpiresIn: null,
      nextRefresh: null,
      refreshMode: null,
    },
    {
      provider: "kimi_local_web_api",
      displayName: "Kimi Local Web API",
      status: "unknown",
      lastRefresh: null,
      lastSuccess: null,
      lastError: null,
      latency: 0,
      errorClass: null,
      model: "kimi-k3",
      evidencePath: EVIDENCE_PATH,
      tokenExpiresIn: null,
      nextRefresh: null,
      refreshMode: null,
    },
  ];
  for (const d of defaults) {
    if (!records.has(d.provider)) records.set(d.provider, d);
  }
}
initDefaults();

function recordEvidence(type: string, provider: string, payload: Record<string, unknown>): void {
  appendEvidenceRecord({
    evidence_id: `provider-ops-${provider}-${type}-${Date.now()}`,
    trace_id: `provider:${provider}`,
    job_id: "provider_ops",
    type: type as any,
    timestamp: new Date().toISOString(),
    payload: { provider, ...payload },
  }).catch(() => {});
}

async function probeEndpoint(path: string, timeoutMs = 5000): Promise<{ ok: boolean; latency: number; data: any; error?: string }> {
  const start = Date.now();
  try {
    const resp = await fetch(`${BASE_URL}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
    const latency = Date.now() - start;
    const data = await resp.json().catch(() => ({}));
    return { ok: resp.ok, latency, data, error: resp.ok ? undefined : `HTTP ${resp.status}` };
  } catch (err: any) {
    return { ok: false, latency: Date.now() - start, data: null, error: err?.message || "fetch failed" };
  }
}

async function chatCompletion(provider: ProviderOpsProvider, model: string): Promise<{ ok: boolean; latency: number; text?: string; error?: string }> {
  const start = Date.now();
  try {
    const resp = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply exactly: PONG" }],
      }),
      signal: AbortSignal.timeout(60000),
    });
    const latency = Date.now() - start;
    const data = await resp.json().catch(() => ({})) as any;
    if (resp.ok && data?.choices?.[0]?.message?.content) {
      return { ok: true, latency, text: data.choices[0].message.content };
    }
    const errMsg = data?.error?.message || `HTTP ${resp.status}`;
    const isAuth = /401|unauthorized|token missing|permission_denied|REASON_ANONYMOUS_REQUIRE_LOGIN/i.test(errMsg);
    return { ok: false, latency, error: isAuth ? `[auth_expired] ${errMsg}` : errMsg };
  } catch (err: any) {
    return { ok: false, latency: Date.now() - start, error: err?.message || "fetch failed" };
  }
}

function classifyError(error: string | null): string {
  if (!error) return "";
  if (/auth_expired|401|unauthorized|token missing|permission_denied|REASON_ANONYMOUS_REQUIRE_LOGIN/i.test(error)) return "auth_expired";
  if (/timeout|timed out|abort/i.test(error)) return "timeout";
  if (/cooldown/i.test(error)) return "cooldown";
  if (/network|refused|ECONNREFUSED|econnrefused/i.test(error)) return "network";
  return "unknown";
}

export const ProviderOps = {
  async status(): Promise<ProviderOpsRecord[]> {
    const all: ProviderOpsRecord[] = [];
    for (const [provider, record] of records) {
      const results = await Promise.allSettled([
        probeEndpoint("/health"),
        chatCompletion(provider, record.model),
      ]);

      const healthResult = results[0].status === "fulfilled" ? results[0].value : { ok: false, latency: 0, data: null, error: "probe failed" };
      const chatResult = results[1].status === "fulfilled" ? results[1].value : { ok: false, latency: 0, error: "probe failed" };

      let status: ProviderOpsStatus = "unknown";
      if (!healthResult.ok) {
        status = "down";
      } else if (chatResult.ok) {
        status = "healthy";
        record.lastSuccess = Date.now();
      } else if (chatResult.error?.includes("auth_expired")) {
        status = "auth_expired";
      } else {
        status = "degraded";
      }

      record.status = status;
      record.latency = chatResult.latency || healthResult.latency;
      record.lastError = chatResult.error || healthResult.error || null;
      record.errorClass = classifyError(record.lastError);

      // Run scheduler tick to update token expiry info
      const authState = await AuthScheduler.tick(provider);
      record.tokenExpiresIn = authState.tokenExpiresIn;
      record.nextRefresh = authState.nextRefresh;
      record.refreshMode = authState.refreshMode;
      record.lastRefresh = authState.lastRefresh;

      all.push({ ...record });

      recordEvidence("provider.status.checked", provider, {
        status,
        latency: record.latency,
        error: record.lastError,
        errorClass: record.errorClass,
      });
    }
    return all;
  },

  async refresh(provider: ProviderOpsProvider): Promise<{ ok: boolean; error?: string }> {
    const record = records.get(provider);
    if (!record) return { ok: false, error: `Unknown provider: ${provider}` };

    recordEvidence("provider.refresh.started", provider, {});
    record.lastRefresh = Date.now();

    try {
      const encodedProvider = provider.startsWith("glm") ? "glm" : "kimi";
      const { execSync } = await import("child_process");
      const scriptPath = path.resolve(__dirname, "../../../FreeGLMKimiAPI/scripts/zai_browser_auth.js");
      execSync(
        `ZAI_PROVIDER=${encodedProvider} node "${scriptPath}"`,
        { env: { ...process.env, ZAI_REUSE_CHROME: "1" }, stdio: "inherit", timeout: 180000 },
      );
      recordEvidence("provider.refresh.completed", provider, {});
      return { ok: true };
    } catch (err: any) {
      const error = err?.message || "refresh failed";
      record.lastError = error;
      record.errorClass = classifyError(error);
      recordEvidence("provider.refresh.failed", provider, { error });
      return { ok: false, error };
    }
  },

  async smoke(provider: ProviderOpsProvider): Promise<{ ok: boolean; latency?: number; text?: string; error?: string }> {
    const record = records.get(provider);
    if (!record) return { ok: false, error: `Unknown provider: ${provider}` };

    recordEvidence("provider.smoke.started", provider, {});

    const result = await chatCompletion(provider, record.model);
    if (result.ok) {
      record.lastSuccess = Date.now();
      record.lastError = null;
      record.errorClass = null;
      record.status = "healthy";
      recordEvidence("provider.smoke.completed", provider, { latency: result.latency, text_preview: result.text?.slice(0, 80) });
    } else {
      record.lastError = result.error || null;
      record.errorClass = classifyError(result.error || null);
      recordEvidence("provider.smoke.failed", provider, { latency: result.latency, error: result.error });
    }
    return result;
  },
};
