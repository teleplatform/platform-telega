import type { ProviderId, RuntimeRole } from "./provider-resolution.js";
import type { BridgeProviderId } from "../providers/creator/session/session-registry.js";
import type { ResolvedProviderConfig } from "./provider-resolution.js";
import { recordMetric } from "./provider-telemetry.js";
import { checkBudget, DEFAULT_BUDGET_POLICY, type BudgetPolicy } from "./provider-budget.js";
import { addDecision, completeTrace } from "./provider-trace.js";

export type SessionProviderId = BridgeProviderId;

function normalizeBridgeProviderId(id: BridgeProviderId | string): ProviderId {
  return id as ProviderId;
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ExecutionContext = {
  role: RuntimeRole;
  traceId: string;
  budgetPolicy?: BudgetPolicy;
  sessionSpent?: number;
  taskType?: string;
};

export type ExecutionRequest = {
  resolved: ResolvedProviderConfig;
  messages: ChatMessage[];
  systemPrompt?: string;
  context: ExecutionContext;
};

export type ExecutionResult = {
  ok: boolean;
  provider: ProviderId;
  model: string;
  text?: string;
  error?: {
    type: "auth" | "network" | "rate_limit" | "invalid_request" | "unknown" | "budget";
    message: string;
  };
  fallbackUsed: boolean;
};

function isFallbackAllowed(errorType: string | undefined): boolean {
  if (!errorType) return false;
  return ["network", "rate_limit", "unknown", "budget"].includes(errorType);
}

function toFallbackProvider(target: ProviderId): ResolvedProviderConfig {
  const defaults: Record<ProviderId, ResolvedProviderConfig> = {
    openai_api: {
      provider: "openai_api",
      model: "gpt-4o-mini",
      fallbackTo: [],
      apiKeyEnv: "OPENAI_API_KEY",
      role: "user",
      source: "fallback",
      rawInput: "openai_api:gpt-4o-mini",
    },
    openai_web: {
      provider: "openai_web",
      model: "gpt-4o-mini",
      fallbackTo: [],
      role: "creator",
      source: "fallback",
      rawInput: "openai_web:gpt-4o-mini",
    },
    local: {
      provider: "local",
      model: "local-demo",
      fallbackTo: [],
      role: "user",
      source: "fallback",
      rawInput: "local:local-demo",
    },
    deepseek_api: {
      provider: "deepseek_api",
      model: process.env.DEEPSEEK_MODEL_DEFAULT || "deepseek-v4-flash",
      fallbackTo: ["local"],
      apiKeyEnv: "DEEPSEEK_API_KEY",
      role: "user",
      source: "fallback",
      rawInput: `deepseek_api:${process.env.DEEPSEEK_MODEL_DEFAULT || "deepseek-v4-flash"}`,
    },
    qwen_api: {
      provider: "qwen_api",
      model: "qwen-plus",
      fallbackTo: ["local"],
      apiKeyEnv: "QWEN_API_KEY",
      role: "user",
      source: "fallback",
      rawInput: "qwen_api:qwen-plus",
    },
    chatgpt_web: {
      provider: "chatgpt_web",
      model: "gpt-4o",
      fallbackTo: ["qwen_web", "deepseek_web", "openai_api", "local"],
      role: "creator",
      source: "fallback",
      rawInput: "chatgpt_web:gpt-4o",
    },
    qwen_web: {
      provider: "qwen_web",
      model: "qwen-plus",
      fallbackTo: ["deepseek_web", "qwen_api", "local"],
      role: "creator",
      source: "fallback",
      rawInput: "qwen_web:qwen-plus",
    },
    deepseek_web: {
      provider: "deepseek_web",
      model: process.env.DEEPSEEK_MODEL_DEFAULT || "deepseek-v4-flash",
      fallbackTo: ["deepseek_api", "local"],
      role: "creator",
      source: "fallback",
      rawInput: `deepseek_web:${process.env.DEEPSEEK_MODEL_DEFAULT || "deepseek-v4-flash"}`,
    },
    grok_web: {
      provider: "grok_web",
      model: "grok-2",
      fallbackTo: [],
      role: "creator",
      source: "fallback",
      rawInput: "grok_web:grok-2",
    },
    kimi_web: {
      provider: "kimi_web",
      model: "kimi-k2.5",
      fallbackTo: [],
      role: "creator",
      source: "fallback",
      rawInput: "kimi_web:kimi-k2.5",
    },
    perplexity_web: {
      provider: "perplexity_web",
      model: "sonar",
      fallbackTo: ["qwen_web", "chatgpt_web"],
      role: "creator",
      source: "fallback",
      rawInput: "perplexity_web:sonar",
    },
  };
  return defaults[target] || defaults.local;
}

export async function executeWithPolicy(req: ExecutionRequest): Promise<ExecutionResult> {
  const { resolved, messages, systemPrompt, context } = req;
  const start = Date.now();

  // Track fallback chain
  const fallbackChain: ProviderId[] = [];

  // 1. Role gate check - web providers require creator role
  const requiresCreatorRole = resolved.provider.endsWith("_web") || resolved.role === "creator";
  const hasRequiredRole = context.role === "creator" || context.role === "user";
  const roleMatch = !requiresCreatorRole || context.role === resolved.role;
  
  if (requiresCreatorRole && !roleMatch) {
    addDecision(context.traceId, {
      step: "role",
      provider: resolved.provider,
      model: resolved.model,
      decision: "blocked",
      reason: `role_mismatch:${context.role}_required:${resolved.role}`,
    });
    
    const latency = Date.now() - start;
    recordMetric({
      traceId: context.traceId,
      provider_requested: resolved.provider,
      provider_primary: resolved.provider,
      provider_final: resolved.provider,
      model: resolved.model,
      success: false,
      error_type: "auth",
      latency_ms: latency,
      fallback_used: false,
      timestamp: Date.now(),
    });
    return {
      ok: false,
      provider: resolved.provider,
      model: resolved.model,
      error: { type: "auth", message: "role_mismatch" },
      fallbackUsed: false,
    };
  }

  addDecision(context.traceId, {
    step: "role",
    provider: resolved.provider,
    model: resolved.model,
    decision: "selected",
    reason: `role:${context.role}`,
  });

  // 2. Budget gate check
  const budgetPolicy = context.budgetPolicy || DEFAULT_BUDGET_POLICY;
  const sessionSpent = context.sessionSpent || 0;
  
  const budgetDecision = checkBudget(
    resolved.provider,
    resolved.model,
    0,
    0,  
    budgetPolicy,
    sessionSpent
  );

  if (!budgetDecision.allowed) {
    addDecision(context.traceId, {
      step: "budget",
      provider: resolved.provider,
      model: resolved.model,
      decision: "blocked",
      reason: budgetDecision.reason || "budget_exceeded",
    });
    
    const latency = Date.now() - start;
    recordMetric({
      traceId: context.traceId,
      provider_requested: resolved.provider,
      provider_primary: resolved.provider,
      provider_final: resolved.provider,
      model: resolved.model,
      success: false,
      error_type: "budget",
      latency_ms: latency,
      fallback_used: false,
      timestamp: Date.now(),
    });
    
    return {
      ok: false,
      provider: resolved.provider,
      model: resolved.model,
      error: { type: "budget", message: budgetDecision.reason || "budget_exceeded" },
      fallbackUsed: false,
    };
  }

  addDecision(context.traceId, {
    step: "budget",
    provider: resolved.provider,
    model: resolved.model,
    decision: "selected",
    reason: "budget_available",
  });

  // 3. Primary provider attempt
  const primary = await callProvider(resolved, messages, systemPrompt, context);

  if (primary.ok) {
    addDecision(context.traceId, {
      step: "execute",
      provider: resolved.provider,
      model: resolved.model,
      decision: "selected",
      reason: "primary_provider_succeeded",
    });
    
    completeTrace(context.traceId, resolved.provider, resolved.model, true, false);
    
    const latency = Date.now() - start;
    recordMetric({
      traceId: context.traceId,
      provider_requested: resolved.provider,
      provider_primary: resolved.provider,
      provider_final: resolved.provider,
      model: resolved.model,
      success: true,
      latency_ms: latency,
      fallback_used: false,
      timestamp: Date.now(),
    });
    return primary;
  }

  // 4. Fallback eligibility check
  if (!isFallbackAllowed(primary.error?.type)) {
    addDecision(context.traceId, {
      step: "execute",
      provider: resolved.provider,
      model: resolved.model,
      decision: "blocked",
      reason: primary.error?.type || "unknown_error",
    });
    
    completeTrace(context.traceId, resolved.provider, resolved.model, false, false, primary.error?.type);
    
    const latency = Date.now() - start;
    recordMetric({
      traceId: context.traceId,
      provider_requested: resolved.provider,
      provider_primary: resolved.provider,
      provider_final: resolved.provider,
      model: resolved.model,
      success: false,
      error_type: primary.error?.type,
      latency_ms: latency,
      fallback_used: false,
      timestamp: Date.now(),
    });
    return primary;
  }

  // 4. Fallback chain execution
  addDecision(context.traceId, {
    step: "execute",
    provider: resolved.provider,
    model: resolved.model,
    decision: "fallback_to",
    reason: `primary_failed:${primary.error?.type}`,
  });
  
  for (const fallbackTarget of resolved.fallbackTo) {
    fallbackChain.push(fallbackTarget);
    const fallbackConfig = toFallbackProvider(fallbackTarget);
    
    addDecision(context.traceId, {
      step: "fallback",
      provider: fallbackTarget,
      model: fallbackConfig.model,
      decision: "selected",
      reason: "fallback_attempt",
    });

    const attempt = await callProvider(fallbackConfig, messages, systemPrompt, context);

    if (attempt.ok) {
      completeTrace(context.traceId, fallbackTarget, fallbackConfig.model, true, true);
      
      const latency = Date.now() - start;
      recordMetric({
        traceId: context.traceId,
        provider_requested: resolved.provider,
        provider_primary: resolved.provider,
        provider_final: fallbackTarget,
        model: resolved.model,
        success: true,
        latency_ms: latency,
        fallback_used: true,
        fallback_chain: fallbackChain,
        timestamp: Date.now(),
      });
      return {
        ...attempt,
        fallbackUsed: true,
      };
    }
    
    addDecision(context.traceId, {
      step: "fallback",
      provider: fallbackTarget,
      model: fallbackConfig.model,
      decision: "blocked",
      reason: attempt.error?.type || "unknown",
    });
  }

  // 5. No fallback succeeded - return primary error
  completeTrace(context.traceId, resolved.provider, resolved.model, false, true, primary.error?.type);
  
  addDecision(context.traceId, {
    step: "final",
    provider: resolved.provider,
    model: resolved.model,
    decision: "blocked",
    reason: "all_providers_failed",
  });
  
  const latency = Date.now() - start;
  recordMetric({
    traceId: context.traceId,
    provider_requested: resolved.provider,
    provider_primary: resolved.provider,
    provider_final: resolved.provider,
    model: resolved.model,
    success: false,
    error_type: primary.error?.type,
    latency_ms: latency,
    fallback_used: true,
    fallback_chain: fallbackChain,
    timestamp: Date.now(),
  });
  return primary;
}

async function callProvider(
  config: ResolvedProviderConfig,
  messages: ChatMessage[],
  systemPrompt?: string,
  context?: ExecutionContext
): Promise<ExecutionResult> {
  // Import adapters dynamically to avoid circular deps
  const { openaiChat } = await import("../providers/openai/chat.js");
  const { chat: localChat } = await import("../providers/local/chat.js");
  const { localDemo } = await import("../providers/local/demo.js");
  const { callDeepSeek } = await import("../providers/deepseek/chat.js");
  const { callQwen } = await import("../providers/qwen/chat.js");
  const { callCreator } = await import("../providers/creator/chat.js");

  const provider = config.provider;
  const model = config.model;

  // Session transport handling for creator web providers
  if (provider.endsWith("_web")) {
    return await executeWebProviderViaBridge(provider as SessionProviderId, messages, systemPrompt, context);
  }

  try {
    let result;

    if (provider === "openai_api") {
      const hasKey = Boolean(process.env.OPENAI_API_KEY?.trim());
      if (!hasKey) {
        return {
          ok: false,
          provider: "openai_api",
          model,
          error: { type: "auth", message: "OPENAI_API_KEY not configured" },
          fallbackUsed: false,
        };
      }
      result = await openaiChat({ message: messages.at(-1)?.content || "", model, system: systemPrompt });
    } else if (provider === "local") {
      if (model === "local-demo") {
        result = await localDemo({ message: messages.at(-1)?.content || "", model, system: systemPrompt });
      } else {
        const hasLocal = Boolean(process.env.LOCAL_OPENAI_BASE_URL?.trim()) &&
                         Boolean(process.env.LOCAL_OPENAI_MODEL || process.env.LOCAL_OPENAI_MODEL_DEFAULT);
        if (!hasLocal) {
          return {
            ok: false,
            provider: "local",
            model,
            error: { type: "invalid_request", message: "Local provider not configured" },
            fallbackUsed: false,
          };
        }
        result = await localChat({ message: messages.at(-1)?.content || "", model, system: systemPrompt });
      }
    } else if (provider === "deepseek_api") {
      const taskType = context?.taskType ?? "chat";
      return await callDeepSeek(model, messages, systemPrompt, taskType);
    } else if (provider === "qwen_api") {
      return await callQwen(model, messages, systemPrompt);
    } else if (provider === "chatgpt_web") {
      return await callCreator(model, messages, systemPrompt);
    } else {
      return {
        ok: false,
        provider: config.provider,
        model,
        error: { type: "unknown", message: `Unknown provider: ${provider}` },
        fallbackUsed: false,
      };
    }

    return {
      ok: true,
      provider: config.provider,
      model: config.model,
      text: result.output,
      fallbackUsed: false,
    };
  } catch (e: any) {
    const errorMessage = e?.message || "unknown error";
    const isAuthError = errorMessage.includes("401") || errorMessage.includes("auth") || errorMessage.includes("API key");
    const isRateLimit = errorMessage.includes("429") || errorMessage.includes("rate limit");
    const isNetwork = errorMessage.includes("ECONNREFUSED") || errorMessage.includes("ETIMEDOUT") || errorMessage.includes("network");
    const isInvalid = errorMessage.includes("400") || errorMessage.includes("invalid");

    let errorType: "auth" | "network" | "rate_limit" | "invalid_request" | "unknown";
    if (isAuthError) errorType = "auth";
    else if (isRateLimit) errorType = "rate_limit";
    else if (isNetwork) errorType = "network";
    else if (isInvalid) errorType = "invalid_request";
    else errorType = "unknown";

    console.log(`[execution] ${provider} failed:`, errorType, errorMessage);

    return {
      ok: false,
      provider: config.provider,
      model: config.model,
      error: { type: errorType, message: errorMessage },
      fallbackUsed: false,
    };
  }
}

interface CreatorSessionExecutionResult {
  success: boolean;
  provider_requested: string;
  provider_selected: string;
  provider_final?: string;
  transport: "session";
  session_state: "ok" | "expired" | "captcha" | "blocked" | "not_configured" | "unknown";
  submit_status?: "sent" | "failed";
  response_status?: "received" | "timeout" | "parse_failed";
  output_text?: string;
  fallback_used: boolean;
  fallback_reason?: string;
  error_code?: string;
  error_message?: string;
  trace_id: string;
  evidence: string[];
}

async function executeCreatorSessionProvider(
  provider: SessionProviderId,
  messages: ChatMessage[],
  systemPrompt: string | undefined,
  context?: ExecutionContext
): Promise<ExecutionResult> {
  const traceId = context?.traceId || `session-${Date.now()}`;
  const role = context?.role || "user";
  
  try {
    const { getSessionBridge } = await import("../providers/creator/session/session-bridge.js");
    const sessionBridge = getSessionBridge();
    
    const prompt = messages.map(m => m.role === "system" ? `System: ${m.content}` : `${m.role}: ${m.content}`).join("\n");
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
    
    const result = await sessionBridge.generate(fullPrompt, {
      provider,
      traceId,
      systemPrompt: systemPrompt,
      creatorMode: role === "creator",
    });
    
    console.log(`[executeCreatorSessionProvider] sessionBridge.generate result:`, JSON.stringify({
      success: result.success,
      provider: result.provider,
      session_state: result.session_state,
      output_text: result.output_text?.slice(0, 100),
      submit_status: result.submit_status,
      response_status: result.response_status,
      error_code: result.error_code,
      evidence: result.evidence,
    }));
    
const providerRequested = provider;
  const providerSelected = provider as ProviderId;
  const providerFinal = result.success ? (provider as ProviderId) : undefined;
  
  addDecision(traceId, {
    step: "session_transport",
    provider: providerSelected,
    model: provider,
    decision: result.success ? "success" : "failed",
    reason: result.session_state,
    evidence: result.evidence || [],
    });
    
    if (result.success) {
      addDecision(traceId, {
        step: "provider_final",
        provider: providerFinal!,
        model: provider,
        decision: "selected",
        reason: `session:${result.session_state},submit:${result.submit_status},response:${result.response_status}`,
      });
      
      return {
        ok: true,
        provider: providerFinal!,
        model: provider,
        text: result.output_text,
        fallbackUsed: false,
      };
    } else {
      let errorType: "auth" | "network" | "rate_limit" | "invalid_request" | "unknown" = "unknown";
      
      if (result.session_state === "expired" || result.session_state === "not_configured") {
        errorType = "auth";
      } else if (result.session_state === "rate_limited") {
        errorType = "rate_limit";
      } else if (result.session_state === "blocked" || result.session_state === "captcha") {
        errorType = "network";
      }
      
      const fallbackRecommended = ["expired", "captcha", "rate_limited"].includes(result.session_state);
      
      addDecision(traceId, {
        step: "provider_final",
        provider: providerRequested,
        model: provider,
        decision: fallbackRecommended ? "fallback_to_api" : "hard_fail",
        reason: `${result.error_code || result.session_state}:submit=${result.submit_status},response=${result.response_status}`,
      });
      
      return {
        ok: false,
        provider: providerSelected,
        model: provider,
        error: { 
          type: errorType, 
          message: result.error_code || result.session_state || "session_bridge_failed" 
        },
        fallbackUsed: fallbackRecommended,
      };
    }
  } catch (e: any) {
    const errorMessage = e?.message || "session_bridge_error";
    
    addDecision(traceId, {
      step: "session_transport",
      provider,
      model: provider,
      decision: "exception",
      reason: errorMessage,
    });
    
    return {
      ok: false,
      provider,
      model: provider,
      error: { type: "unknown", message: errorMessage },
      fallbackUsed: true,
    };
  }
}

async function executeWebProviderViaBridge(
  provider: SessionProviderId,
  messages: ChatMessage[],
  systemPrompt: string | undefined,
  context?: ExecutionContext
): Promise<ExecutionResult> {
  const traceId = context?.traceId || `web-${Date.now()}`;
  
  try {
    const { executeWebProviderWithFallback } = await import("../providers/web-provider-stub.js");
    
    const prompt = messages.map(m => m.role === "system" ? `System: ${m.content}` : `${m.role}: ${m.content}`).join("\n");
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
    
    const result = await executeWebProviderWithFallback({
      preferredProvider: provider,
      prompt: fullPrompt,
      timeoutMs: 60000,
    });
    
    console.log(`[executeWebProviderWithFallback] result:`, JSON.stringify({
      ok: result.ok,
      provider: result.provider,
      transport: result.transport,
      responseText: result.responseText?.slice(0, 100),
      attempts: result.attempts?.length,
      reason: result.reason,
    }));
    
    for (const attempt of result.attempts || []) {
      addDecision(traceId, {
        step: "web_transport",
        provider: attempt.provider,
        model: provider,
        decision: attempt.executed ? (attempt.ok ? "success" : "failed") : "blocked",
        reason: attempt.reason || (attempt.ready ? "executed" : "not_ready"),
        evidence: [`transport:${attempt.transport}`],
      });
    }
    
    if (result.ok) {
      return {
        ok: true,
        provider: result.provider,
        model: provider,
        text: result.responseText || "Response via web provider",
        fallbackUsed: result.attempts?.length ? result.attempts.length > 1 : false,
      };
    } else {
      return {
        ok: false,
        provider: result.provider,
        model: provider,
        error: { type: "unknown", message: result.reason || "web_provider_failed" },
        fallbackUsed: true,
      };
    }
  } catch (e: any) {
    const errorMessage = e?.message || "web_provider_error";
    
    addDecision(traceId, {
      step: "web_transport",
      provider,
      model: provider,
      decision: "exception",
      reason: errorMessage,
    });
    
    return {
      ok: false,
      provider,
      model: provider,
      error: { type: "unknown", message: errorMessage },
      fallbackUsed: true,
    };
  }
}
