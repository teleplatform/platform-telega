import type { ChatMessage } from "../../core/provider-execution.js";
import type { ExecutionResult } from "../../core/provider-execution.js";
import { CreatorBridgeProvider } from "./creator-bridge.js";

export interface ProviderHealth {
  provider: string;
  successCount: number;
  failCount: number;
  lastError?: string;
  lastErrorTime?: number;
  avgLatencyMs: number;
  totalLatencyMs: number;
  cooldownUntil?: number;
}

const DEFAULT_HEALTH_THRESHOLD = 0.5;
const COOLDOWN_MS = {
  RATE_LIMIT: 5 * 60 * 1000,
  TIMEOUT: 60 * 1000,
  PARTIAL: 30 * 1000,
  DEFAULT: 60 * 1000,
};

const RETRY_DELAYS = [1000, 2000, 4000];
const MAX_RETRIES = 3;

const RETRYABLE_ERRORS = ["EMPTY_OUTPUT", "PARTIAL_OUTPUT", "TIMEOUT", "ETIMEDOUT", "ECONNREFUSED", "network"];

const providerHealthMap = new Map<string, ProviderHealth>();

function initHealth(provider: string): ProviderHealth {
  return {
    provider,
    successCount: 0,
    failCount: 0,
    avgLatencyMs: 0,
    totalLatencyMs: 0,
  };
}

function getHealth(provider: string): ProviderHealth {
  if (!providerHealthMap.has(provider)) {
    providerHealthMap.set(provider, initHealth(provider));
  }
  return providerHealthMap.get(provider)!;
}

function recordSuccess(provider: string, latencyMs: number): void {
  const health = getHealth(provider);
  health.successCount++;
  health.totalLatencyMs += latencyMs;
  health.avgLatencyMs = Math.round(health.totalLatencyMs / (health.successCount + health.failCount));
  health.lastError = undefined;
  health.lastErrorTime = undefined;
  providerHealthMap.set(provider, health);
}

function recordFailure(provider: string, error: string): void {
  const health = getHealth(provider);
  health.failCount++;
  health.lastError = error;
  health.lastErrorTime = Date.now();

  if (error.includes("rate_limit") || error.includes("429")) {
    health.cooldownUntil = Date.now() + COOLDOWN_MS.RATE_LIMIT;
  } else if (error.includes("timeout") || error.includes("ETIMEDOUT")) {
    health.cooldownUntil = Date.now() + COOLDOWN_MS.TIMEOUT;
  } else if (error.includes("partial")) {
    health.cooldownUntil = Date.now() + COOLDOWN_MS.PARTIAL;
  }

  health.avgLatencyMs = Math.round(health.totalLatencyMs / (health.successCount + health.failCount));
  providerHealthMap.set(provider, health);
}

function isRetryable(error: string): boolean {
  return RETRYABLE_ERRORS.some((e) => error.toLowerCase().includes(e.toLowerCase()));
}

function isInCooldown(provider: string): boolean {
  const health = getHealth(provider);
  if (health.cooldownUntil && Date.now() < health.cooldownUntil) {
    return true;
  }
  return false;
}

export function getProviderHealth(provider: string): ProviderHealth {
  return getHealth(provider);
}

export function getAllProviderHealth(): ProviderHealth[] {
  return Array.from(providerHealthMap.values());
}

export function getBestProvider(fallbacks: string[]): string | null {
  for (const provider of fallbacks) {
    const health = getHealth(provider);
    const successRate = health.successCount / (health.successCount + health.failCount || 1);
    if (successRate >= DEFAULT_HEALTH_THRESHOLD && !isInCooldown(provider)) {
      return provider;
    }
  }
  return null;
}

interface StabilityOptions {
  model: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  fallbackProviders?: string[];
  expectedMinLength?: number;
}

const creatorBridge = new CreatorBridgeProvider();

function parsePartialOutput(output: string, expectedMin?: number): { isPartial: boolean; recovered?: string } {
  if (!output || output.length === 0) {
    return { isPartial: true };
  }

  if (expectedMin && output.length < expectedMin * 0.5) {
    return { isPartial: true };
  }

  const truncations = [
    /continue$/i,
    /continu(ing|e)$/i,
    /^$/m,
    /\.\.\.$/,
    /and then$/i,
    /so$/i,
    /but$/i,
    /how(ever)?$/i,
  ];

  if (truncations.some((r) => r.test(output.trim()))) {
    return { isPartial: true };
  }

  return { isPartial: false };
}

async function callWithRetry(
  provider: string,
  prompt: string,
  systemPrompt?: string,
  traceId?: string
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = RETRY_DELAYS[attempt - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        await new Promise((r) => setTimeout(r, delay));
      }

      const result = await creatorBridge.generate(prompt, {
        bridge_model: provider as "openai" | "qwen" | "deepseek",
        system: systemPrompt,
        trace_id: traceId || `retry-${Date.now()}-${attempt}`,
      });

      return result;
    } catch (e: any) {
      lastError = e;
      const errorMsg = e?.message || "unknown";

      if (!isRetryable(errorMsg)) {
        throw e;
      }

      console.log(`[stability] retryable error on ${provider}: ${errorMsg} (attempt ${attempt + 1})`);
    }
  }

  throw lastError || new Error("max retries exceeded");
}

export async function callCreatorStable(opts: StabilityOptions): Promise<ExecutionResult> {
  const { model: requestedModel, messages, systemPrompt, fallbackProviders, expectedMinLength } = opts;

  const defaultFallbacks = ["openai", "qwen", "deepseek"];
  const fallbacks = fallbackProviders || defaultFallbacks;

  let bridgeModel: "openai" | "qwen" | "deepseek" = "openai";
  if (requestedModel.includes("qwen")) {
    bridgeModel = "qwen";
  } else if (requestedModel.includes("deepseek")) {
    bridgeModel = "deepseek";
  }

  const t0 = Date.now();

  for (let i = 0; i < fallbacks.length; i++) {
    const provider = fallbacks[i];
    const health = getHealth(provider);

    if (isInCooldown(provider)) {
      console.log(`[stability] provider ${provider} in cooldown, trying next`);
      continue;
    }

    try {
      const userMessage = messages.at(-1)?.content || "";
      const traceId = `stable-${Date.now()}-${provider}`;

      let result = await callWithRetry(provider, userMessage, systemPrompt, traceId);

      const parseResult = parsePartialOutput(result, expectedMinLength);
      if (parseResult.isPartial) {
        console.log(`[stability] partial output detected for ${provider}, attempting recovery`);

        const retryResult = await callWithRetry(provider, userMessage, systemPrompt, `recover-${traceId}`);
        if (retryResult.length > result.length) {
          result = retryResult;
          console.log(`[stability] recovered partial output: ${result.length} chars`);
        }
      }

      const latency = Date.now() - t0;
      recordSuccess(provider, latency);

      console.log(JSON.stringify({
        event: "stability_call_success",
        provider,
        latency_ms: latency,
        output_length: result.length,
      }));

      return {
        ok: true,
        provider: provider as any,
        model: requestedModel,
        text: result,
        fallbackUsed: i > 0,
      };
    } catch (e: any) {
      const errorMsg = e?.message || "unknown error";
      recordFailure(provider, errorMsg);

      console.log(JSON.stringify({
        event: "stability_call_failed",
        provider,
        error: errorMsg,
        is_retryable: isRetryable(errorMsg),
      }));

      if (isRetryable(errorMsg) && i < fallbacks.length - 1) {
        console.log(`[stability] ${provider} failed, trying next fallback`);
        continue;
      }

      const isNetwork = errorMsg.includes("ECONNREFUSED") || errorMsg.includes("ETIMEDOUT") || errorMsg.includes("network");
      const isAuth = errorMsg.includes("401") || errorMsg.includes("auth") || errorMsg.includes("API key");

      return {
        ok: false,
        provider: provider as any,
        model: requestedModel,
        error: {
          type: isAuth ? "auth" : isNetwork ? "network" : "unknown",
          message: errorMsg,
        },
        fallbackUsed: i > 0,
      };
    }
  }

  return {
    ok: false,
    provider: "all" as any,
    model: requestedModel,
    error: {
      type: "network",
      message: "All providers failed",
    },
    fallbackUsed: true,
  };
}

export function getProviderStatus() {
  const health = getAllProviderHealth();
  const output: Record<string, any> = {};

  for (const h of health) {
    const total = h.successCount + h.failCount;
    const successRate = total > 0 ? (h.successCount / total).toFixed(2) : "N/A";
    const status = isInCooldown(h.provider) ? "COOLDOWN" : "READY";
    
    output[h.provider] = {
      success_rate: successRate,
      avg_latency_ms: h.avgLatencyMs,
      last_error: h.lastError,
      status,
      cooldown_until: h.cooldownUntil,
    };
  }

  return output;
}