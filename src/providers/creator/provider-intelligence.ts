import type { SessionProviderId } from "./session/session-registry.js";

export type ExecutionMode = "single" | "multi" | "debate" | "research";

export type ErrorCode =
  | "EMPTY_OUTPUT"
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "OVERLOAD"
  | "AUTH_REQUIRED"
  | "DOM_SELECTOR_MISS"
  | "EXTRACTION_FAILED"
  | "UNKNOWN";

export interface ProviderIntelligence {
  provider: SessionProviderId;
  confidence: number;
  bestFor: string[];
  fallbackChain: SessionProviderId[];
  timeoutMs: number;
}

export interface EvidenceLog {
  requestId: string;
  mode: ExecutionMode;
  providers: Array<{
    provider: SessionProviderId;
    status: "attempted" | "success" | "failed";
    latencyMs?: number;
    outputChars?: number;
    errorCode?: ErrorCode;
  }>;
  totalLatencyMs: number;
  finalProvider: SessionProviderId;
  fallbackCount: number;
}

export const PROVIDER_INTELLIGENCE: Record<string, ProviderIntelligence> = {
  perplexity_web: {
    provider: "perplexity_web",
    confidence: 0.85,
    bestFor: ["research", "latest", "source", "find", "news", "verify", "current"],
    fallbackChain: ["perplexity_web", "qwen_web", "chatgpt_web"],
    timeoutMs: 120000,
  },
  deepseek_web: {
    provider: "deepseek_web",
    confidence: 0.8,
    bestFor: ["logic", "code", "analyze", "compare", "strategy"],
    fallbackChain: ["deepseek_web", "qwen_web", "chatgpt_web"],
    timeoutMs: 120000,
  },
  qwen_web: {
    provider: "qwen_web",
    confidence: 0.6,
    bestFor: ["fast", "reasoning", "default"],
    fallbackChain: ["qwen_web", "deepseek_web", "chatgpt_web"],
    timeoutMs: 120000,
  },
  claude_web: {
    provider: "chatgpt_web",
    confidence: 0.7,
    bestFor: ["long", "writing", "document", "think"],
    fallbackChain: ["chatgpt_web", "qwen_web"],
    timeoutMs: 120000,
  },
  chatgpt_web: {
    provider: "chatgpt_web",
    confidence: 0.9,
    bestFor: ["default", "general", "creative"],
    fallbackChain: ["chatgpt_web", "qwen_web", "deepseek_web"],
    timeoutMs: 120000,
  },
  grok_web: {
    provider: "grok_web",
    confidence: 0.5,
    bestFor: ["fast", "creative", "x"],
    fallbackChain: ["grok_web", "qwen_web", "chatgpt_web"],
    timeoutMs: 120000,
  },
  kimi_web: {
    provider: "kimi_web",
    confidence: 0.5,
    bestFor: ["long-context", "document"],
    fallbackChain: ["kimi_web", "qwen_web", "chatgpt_web"],
    timeoutMs: 120000,
  },
};

export function selectProviderByIntent(message: string): SessionProviderId {
  const m = message.toLowerCase();
  
  if (m.includes("latest") || m.includes("news") || m.includes("source") || m.includes("find current") || m.includes("research") || m.includes("verify") || m.includes("сейчас") || m.includes("новост") || m.includes("источник") || m.includes("найди") || m.includes("проверь")) {
    return "perplexity_web";
  }
  
  if (m.includes("code") || m.includes("logic") || m.includes("analyze compare")) {
    return "deepseek_web";
  }
  
  if (m.length > 500 || m.includes("write") || m.includes("document") || m.includes("long")) {
    return "qwen_web";
  }
  
  if (m.includes("strategy") || m.includes("risk") || m.includes("architecture")) {
    return "deepseek_web";
  }
  
  return "qwen_web";
}

export function getFallbackChain(provider: SessionProviderId): SessionProviderId[] {
  const intel = PROVIDER_INTELLIGENCE[provider];
  return intel?.fallbackChain || ["qwen_web", "deepseek_web", "chatgpt_web"];
}

export function classifyError(text: string, error?: Error): ErrorCode {
  if (!text) return "EMPTY_OUTPUT";
  const t = text.toLowerCase();
  
  if (t.includes("overloaded") || t.includes("загружен")) return "OVERLOAD";
  if (t.includes("rate limit") || t.includes("rate limit")) return "RATE_LIMIT";
  if (t.includes("login") || t.includes("auth") || t.includes("войти")) return "AUTH_REQUIRED";
  if (t.includes("network") || t.includes("connection")) return "TIMEOUT";
  if (t.includes("selector") || t.includes("not found")) return "DOM_SELECTOR_MISS";
  if (error?.message?.includes("Timeout")) return "TIMEOUT";
  
  return "UNKNOWN";
}

export async function executeWithFallback(
  provider: SessionProviderId,
  message: string,
  options?: {
    traceId?: string;
    timeoutMs?: number;
    fallbackEnabled?: boolean;
  }
): Promise<{
  text: string;
  provider: SessionProviderId;
  evidence: EvidenceLog;
}> {
  const { getSessionBridge } = await import("./session/session-bridge.js");
  const { providerCooldownManager } = await import("./evidence-store.js");
  const traceId = options?.traceId || `v2-${Date.now()}`;
  const timeoutMs = options?.timeoutMs || 120000;
  const fallbackEnabled = options?.fallbackEnabled !== false;
  
  let chain = fallbackEnabled ? getFallbackChain(provider) : [provider];
  chain = chain.filter(p => !providerCooldownManager.isInCooldown(p));
  
  if (chain.length === 0) {
    chain = [provider];
  }
  
  const evidence: EvidenceLog = {
    requestId: traceId,
    mode: "single",
    providers: [],
    totalLatencyMs: 0,
    finalProvider: provider,
    fallbackCount: 0,
  };
  
  let lastError: Error | undefined;
  let lastErrorCode: ErrorCode | undefined;
  let successProvider: SessionProviderId | undefined;
  
  for (const p of chain) {
    const startTime = Date.now();
    let currentLatencyMs = 0;
    
    try {
      console.log(`[v2] attempting provider: ${p}`);
      
      const bridge = getSessionBridge({ fallbackToApi: false });
      bridge.setCreatorMode(true);
      bridge.enableProvider(p);
      
      const result = await bridge.generate(message, {
        provider: p,
        traceId,
        creatorMode: true,
      });
      
      currentLatencyMs = Date.now() - startTime;
      const errorCode = classifyError(result.output_text || "", result.error_code ? new Error(result.error_code) : undefined);
      
      evidence.providers.push({
        provider: p,
        status: result.success && result.output_text ? "success" : "failed",
        latencyMs: currentLatencyMs,
        outputChars: result.output_text?.length || 0,
        errorCode,
      });
      
      if (result.success && result.output_text) {
        successProvider = p;
        evidence.totalLatencyMs += currentLatencyMs;
        evidence.finalProvider = p;
        
        console.log(`[v2] provider ${p} succeeded`);
        
        return {
          text: result.output_text,
          provider: p,
          evidence,
        };
      }
      
      lastErrorCode = errorCode;
      lastError = new Error(result.error_code || "execution_failed");
      
      if (errorCode === "RATE_LIMIT" || errorCode === "OVERLOAD" || errorCode === "EMPTY_OUTPUT") {
        providerCooldownManager.setCooldown(p, errorCode);
        console.log(`[v2] cooldown set for ${p}: ${errorCode}`);
      }
    } catch (e: any) {
      currentLatencyMs = Date.now() - startTime;
      const errorCode = classifyError("", e);
      
      evidence.providers.push({
        provider: p,
        status: "failed",
        latencyMs: currentLatencyMs,
        errorCode,
      });
      
      lastErrorCode = errorCode;
      lastError = e;
      
      if (errorCode === "RATE_LIMIT" || errorCode === "OVERLOAD" || errorCode === "EMPTY_OUTPUT") {
        providerCooldownManager.setCooldown(p, errorCode);
        console.log(`[v2] cooldown set for ${p}: ${errorCode}`);
      }
    }
    
    evidence.totalLatencyMs += currentLatencyMs;
    evidence.fallbackCount++;
  }
  
  evidence.finalProvider = successProvider || provider;
  if (evidence.providers.length > 0) {
    evidence.providers[evidence.providers.length - 1].status = "failed";
  }
  
  console.log(`[v2] all providers failed: ${lastErrorCode}`);
  
  return {
    text: lastError?.message || "All providers failed",
    provider: chain[chain.length - 1],
    evidence,
  };
}

export async function logEvidence(evidence: EvidenceLog): Promise<void> {
  console.log("[v2-evidence]", {
    requestId: evidence.requestId,
    mode: evidence.mode,
    finalProvider: evidence.finalProvider,
    latencyMs: evidence.totalLatencyMs,
    fallbackCount: evidence.fallbackCount,
    providers: evidence.providers.map(p => ({
      provider: p.provider,
      status: p.status,
      latencyMs: p.latencyMs,
      outputChars: p.outputChars,
      errorCode: p.errorCode,
    })),
  });
  
  try {
    const { addBridgeEvidence } = await import("./evidence-store.js");
    addBridgeEvidence({
      id: evidence.requestId,
      timestamp: Date.now(),
      message: "",
      mode: evidence.mode,
      finalProvider: evidence.finalProvider,
      providers: evidence.providers,
      fallbackCount: evidence.fallbackCount,
      totalLatencyMs: evidence.totalLatencyMs,
      outputLength: evidence.providers.reduce((sum, p) => sum + (p.outputChars || 0), 0),
    });
  } catch (e) {
    // Evidence store optional
  }
}