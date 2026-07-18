import type { ChatRequest, ChatResponse } from "../types/chat.js";
import { localDemo } from "../providers/local/demo.js";
import { chat as localChat } from "../providers/local/chat.js";
import { openaiChat } from "../providers/openai/chat.js";
import { deepseekChat } from "../providers/deepseek/chat.js";
import { qwenChat } from "../providers/qwen/chat.js";
import { executeWebProviderWithFallback } from "../providers/web-provider-stub.js";
import { callLocalProvider } from "../providers/local/localProvider.js";
import { callLocalAuto } from "../providers/local/localAutoProvider.js";
import { callLocalWithFailover, callLocalAutoWithFailover } from "../providers/local/localSafeCall.js";
import { recordSuccess as healthRecordSuccess, recordFailure as healthRecordFailure } from "./provider-health-runtime.js";
import { getFallbackMode } from "../providers/local/localFallbackSettings.js";
import { LOCAL_MODELS, getLocalModel } from "../providers/local/localModels.js";
import { isLocalSessionEnabled, getLocalSession } from "../providers/local/localSessionState.js";
import { writeLocalProviderEvidence } from "../providers/local/localEvidence.js";
import { autoRoute, getAutoRouterConfig } from "../provider-auto-router-v2/router.js";
import { collectEvidence } from "../provider-evidence/collector.js";

function hasOpenAI(): boolean {
  return Boolean((process.env.OPENAI_API_KEY || "").trim());
}

function hasDeepSeek(): boolean {
  return Boolean((process.env.DEEPSEEK_API_KEY || "").trim());
}

function hasQwen(): boolean {
  return Boolean((process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY || "").trim());
}

function hasLocal(): boolean {
  if (process.env.TELEGPT_LOCAL_ENABLED === "false") return false;
  return (
    Boolean((process.env.LOCAL_OPENAI_BASE_URL || "").trim()) &&
    Boolean((process.env.LOCAL_OPENAI_MODEL || "").trim())
  );
}

function isWebBridgeEnabled(): boolean {
  return true; // TGR-6.65: Always enabled for internal bypass/fallback
}

const UI_ONLY_PATTERNS = [
  /развернуть\s*свернуть/gi,
  /свернуть\s*развернуть/gi,
  /expand\s*collapse/gi,
  /collapse\s*expand/gi,
];

function stripUiOnlyTokens(text: string): string {
  let cleaned = text;
  for (const pattern of UI_ONLY_PATTERNS) {
    cleaned = cleaned.replace(pattern, "").trim();
  }
  return cleaned;
}

async function routeWebFallback(req: ChatRequest, webProvider?: string): Promise<ChatResponse> {
  const t0 = Date.now();
  const effectiveProvider = webProvider || "chatgpt_web";

  console.log("[web_provider_selected]", {
    selected_provider: effectiveProvider,
    web_adapter: effectiveProvider,
    model: req.model,
  });

  // TGR-8.47: Provider lock — no silent drift
  if (webProvider && webProvider !== effectiveProvider) {
    console.error("[web_provider_drift]", {
      expected: webProvider,
      actual: effectiveProvider,
      model: req.model,
    });
  }

  const result = await executeWebProviderWithFallback({
    prompt: req.message,
    systemPrompt: req.system,
    preferredProvider: effectiveProvider as any,
    requestId: req.request_id,
  });

  if (!result.ok) {
    const reason = result.reason || "unknown";
    console.error("[router:routeWebFallback:failed]", JSON.stringify({
      trace_id: req.request_id || "unknown",
      reason,
      provider: effectiveProvider,
      attempts: result.attempts?.length || 0,
      attempt_details: result.attempts?.map(a => ({ provider: a.provider, ok: a.ok, reason: a.reason })) || [],
    }));
    throw new Error(`Web fallback failed: ${reason}`);
  }

  const rawOutput = result.responseText || "";
  const output = stripUiOnlyTokens(rawOutput);

  console.log("[router:routeWebFallback]", JSON.stringify({
    provider: result.selectedProvider,
    model: result.provider,
    raw_len: rawOutput.length,
    output_len: output.length,
    stripped: rawOutput.length !== output.length,
    preview: rawOutput.slice(0, 300),
  }));

  if (!output.trim() && rawOutput.trim()) {
    throw new Error(`Web fallback returned UI-only content (${rawOutput.length} chars). Trace available.`);
  }

  collectEvidence({
    provider: effectiveProvider as any,
    model: result.selectedProvider || effectiveProvider,
    intent: (req as any).meta?.intent || "unknown",
    latencyMs: Date.now() - t0,
    success: true,
    fallbackUsed: String(effectiveProvider) !== String(result.selectedProvider),
  });

  return {
    id: `web-${Date.now()}`,
    model: `${effectiveProvider}:${result.selectedProvider || effectiveProvider}`,
    output,
    meta: {
      provider: effectiveProvider as any,
      model: result.selectedProvider,
    }
  };
}

function noProviderConfigured(diagnostics?: {
  requested_model?: string;
  provider_mode?: string;
  activeProviderId?: string;
  activeTier?: string;
  bridge_enabled?: boolean;
  available_providers?: string[];
  disabled_providers?: string[];
  rejection_reasons?: string[];
}): never {
  const err = new Error("No LLM provider configured");
  (err as any).code = "NO_PROVIDER_CONFIGURED";
  (err as any).statusCode = 503;
  (err as any).hint =
    "Set OPENAI_API_KEY or LOCAL_OPENAI_BASE_URL + LOCAL_OPENAI_MODEL";
  (err as any).diagnostics = diagnostics || {};
  (err as any).diagnostics.available_providers =
    diagnostics?.available_providers ?? listAvailableProviders();
  (err as any).diagnostics.disabled_providers =
    diagnostics?.disabled_providers ?? listDisabledProviders();
  throw err;
}

function listAvailableProviders(): string[] {
  const available: string[] = [];
  if (hasOpenAI()) available.push("openai:api");
  if (hasDeepSeek()) available.push("deepseek:api");
  if (hasQwen()) available.push("qwen:api");
  if (hasLocal()) available.push("local:llm");
  if (isWebBridgeEnabled() &&
      (process.env.CREATOR_BRIDGE_ENABLED === "1" || process.env.CREATOR_BRIDGE_ENABLED === "true")) {
    available.push("openai_web:chatgpt");
    available.push("qwen_web:qwen");
    available.push("deepseek_web:deepseek");
  }
  return available;
}

function listDisabledProviders(): string[] {
  const disabled: string[] = [];
  if (process.env.TELEGPT_LOCAL_ENABLED === "false") disabled.push("local:llm");
  if (!hasOpenAI() && process.env.OPENAI_API_KEY) disabled.push("openai:api (key present but empty)");
  return disabled;
}

function providerUnavailable(provider: "local" | "openai" | "deepseek" | "qwen" | "zyloo_api", e?: unknown, diagnostics?: Record<string, unknown>): never {
  const msg =
    typeof (e as any)?.message === "string" && (e as any).message.length
      ? (e as any).message
      : "Provider unavailable";
  const err = new Error(msg);
  (err as any).code = "PROVIDER_UNAVAILABLE";
  (err as any).statusCode = 502;
  (err as any).provider = provider;
  (err as any).diagnostics = {
    provider,
    requested_model: diagnostics?.requested_model,
    bridge_enabled: diagnostics?.bridge_enabled ?? isWebBridgeEnabled(),
    available_providers: listAvailableProviders(),
    disabled_providers: listDisabledProviders(),
  };
  throw err;
}

function makeRequestId(req: ChatRequest): string {
  const anyReq = req as any;
  return (
    (req as any).request_id ||
    anyReq.requestId ||
    anyReq.id ||
    `req_${Date.now()}_${Math.random().toString(16).slice(2)}`
  );
}

function stripPrefix(model: string, prefix: string) {
  return model.startsWith(prefix) ? model.slice(prefix.length) : model;
}

async function routeWithProvider(req: ChatRequest, modelOverride: string): Promise<ChatResponse> {
  const reroute = { ...req, model: modelOverride };
  return await routeChat(reroute);
}

export async function routeChat(req: ChatRequest): Promise<ChatResponse> {
  const t0 = Date.now();

  // Session Lock Override — check BEFORE default model assignment
  const chatId = (req as any).meta?.chatId as string | undefined;
  if (chatId) {
    const session = getLocalSession(chatId);
    if (session && isLocalSessionEnabled(chatId)) {
      const localModel = session.mode === "auto" ? "local:auto" : (session.providerId || "local:auto");
      console.log("[router:session_lock] overriding model before routing", { chatId, mode: session.mode, model: localModel });
      writeLocalProviderEvidence("local_session_used", localModel, session.providerName || "Auto", "ollama", { chatId, mode: session.mode });
      req.model = localModel;
    }
  }

  const model = (req.model || "local:local-demo").trim();
  const request_id = makeRequestId(req);

  console.log("[router:routeChat] input", {
    model,
    request_id,
    active_provider_id: (req as any).active_provider_id,
    provider_access_tier: (req as any).provider_access_tier,
  });

  console.log("[router:routeChat:system]", {
    has_system: Boolean(req.system),
    model,
    system_preview: req.system ? req.system.slice(0, 300) : "(empty)",
  });

  let base: ChatResponse;
  let provider: "local" | "openai" | "openai_web" | "deepseek" | "deepseek_web" | "qwen_web" | "kimi_web" | "kimi_api" | "gemini_web" | "zyloo_api";
  let resolved_model: string;

  // Web provider routes — checked BEFORE API routes to prevent prefix collision
  // e.g. "deepseek_web:..." must not be caught by model.startsWith("deepseek:")
  const WEB_PROVIDER_ROUTES: Array<{ prefix: string; providerId: string }> = [
    { prefix: "openai_web:", providerId: "chatgpt_web" },
    { prefix: "deepseek_web:", providerId: "deepseek_web" },
    { prefix: "qwen_web:", providerId: "qwen_web" },
    { prefix: "kimi_web:", providerId: "kimi_web" },
    { prefix: "gemini_web:", providerId: "gemini_web" },
  ];

  for (const route of WEB_PROVIDER_ROUTES) {
    if (model.startsWith(route.prefix)) {
      resolved_model = stripPrefix(model, route.prefix);
      console.log("[web_provider_selected]", {
        model,
        provider: route.providerId,
        web_adapter: route.providerId,
        request_id,
      });
      return await routeWebFallback(req, route.providerId);
    }
  }

  // Bare web provider names (no model suffix)
  const BARE_WEB_PROVIDERS: Record<string, string> = {
    openai_web: "chatgpt_web",
    deepseek_web: "deepseek_web",
    qwen_web: "qwen_web",
    kimi_web: "kimi_web",
    gemini_web: "gemini_web",
  };
  if (BARE_WEB_PROVIDERS[model]) {
    console.log("[web_provider_selected]", {
      model,
      provider: BARE_WEB_PROVIDERS[model],
      web_adapter: BARE_WEB_PROVIDERS[model],
      request_id,
    });
    return await routeWebFallback(req, BARE_WEB_PROVIDERS[model]);
  }

  // Auto Router v2 — general auto mode for all providers
  if (model === "auto") {
    const arConfig = getAutoRouterConfig();
    if (!arConfig.enabled) {
      console.log("[auto_router:v2] disabled, falling back to local:auto");
      return await routeWithProvider(req, "local:auto");
    }
    const activeProviderId = (req as any).active_provider_id as string | undefined;
    const decision = await autoRoute(req.message || "", {
      selectedProvider: activeProviderId as any,
    });
    console.log("[auto_router:v2] selected", {
      provider: decision.selectedProvider,
      intent: decision.intent,
      score: decision.score,
    });
    // Pass intent through to evidence collection
    (req as any).meta = { ...(req as any).meta, intent: decision.intent };
    const selectedRoute = decision.selectedProvider === "local"
      ? "local:auto"
      : `${decision.selectedProvider}:${decision.selectedModel || decision.selectedProvider}`;
    return await routeWithProvider(req, selectedRoute);
  }

  // API routes
  if (model.startsWith("openai:")) {
    resolved_model = stripPrefix(model, "openai:");
    if (!hasOpenAI()) {
      if (isWebBridgeEnabled()) {
        console.warn(`[router] OpenAI API key missing, falling back to Web Bridge`);
        return await routeWebFallback(req, "chatgpt_web");
      }
      noProviderConfigured({
        requested_model: `openai:${resolved_model}`,
        available_providers: listAvailableProviders(),
        disabled_providers: listDisabledProviders(),
        rejection_reasons: ["OPENAI_API_KEY not set", "Web Bridge fallback skipped or unavailable"],
      });
    }
    provider = "openai";
    try {
      base = await openaiChat({ ...req, model: resolved_model });
    } catch (e) {
      if (isWebBridgeEnabled()) {
        console.warn(`[router] OpenAI API failed, falling back to Web Bridge:`, (e as any)?.message);
        return await routeWebFallback(req, "chatgpt_web");
      }
      providerUnavailable("openai", e);
    }
  } else if (model.startsWith("deepseek:")) {
    resolved_model = stripPrefix(model, "deepseek:");
    if (!hasDeepSeek()) {
      if (isWebBridgeEnabled()) {
        console.warn(`[router] DeepSeek API key missing, falling back to Web Bridge`);
        return await routeWebFallback(req, "deepseek_web");
      }
      noProviderConfigured({
        requested_model: `deepseek:${resolved_model}`,
        available_providers: listAvailableProviders(),
        disabled_providers: listDisabledProviders(),
        rejection_reasons: ["DEEPSEEK_API_KEY not set", "Web Bridge fallback skipped or unavailable"],
      });
    }
    provider = "deepseek";
    console.log("[router:routeChat:deepseek]", { model: resolved_model, request_id });
    try {
      base = await deepseekChat({ ...req, model: resolved_model });
    } catch (e) {
      if (isWebBridgeEnabled()) {
        console.warn(`[router] DeepSeek API failed, falling back to Web Bridge:`, (e as any)?.message);
        return await routeWebFallback(req, "deepseek_web");
      }
      providerUnavailable("deepseek", e);
    }
  } else if (model.startsWith("qwen:")) {
    resolved_model = stripPrefix(model, "qwen:");
    if (!hasQwen()) {
      if (isWebBridgeEnabled()) {
        console.warn(`[router] Qwen API key missing, falling back to Web Bridge`);
        return await routeWebFallback(req, "qwen_web");
      }
      noProviderConfigured({
        requested_model: `qwen:${resolved_model}`,
        available_providers: listAvailableProviders(),
        disabled_providers: listDisabledProviders(),
        rejection_reasons: ["QWEN_API_KEY / DASHSCOPE_API_KEY not set", "Web Bridge fallback skipped or unavailable"],
      });
    }
    provider = "deepseek";
    console.log("[router:routeChat:qwen]", { model: resolved_model, request_id });
    try {
      base = await qwenChat({ ...req, model: resolved_model });
    } catch (e) {
      if (isWebBridgeEnabled()) {
        console.warn(`[router] Qwen API failed, falling back to Web Bridge:`, (e as any)?.message);
        return await routeWebFallback(req, "qwen_web");
      }
      providerUnavailable("deepseek", e);
    }
  } else if (model.startsWith("kimi:")) {
    resolved_model = stripPrefix(model, "kimi:");
    const hasKimiKey = Boolean((process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY || "").trim());
    if (!hasKimiKey) {
      if (isWebBridgeEnabled()) {
        console.warn(`[router] Kimi API key missing, falling back to Browser Bridge`);
        return await routeWebFallback(req, "kimi_local_web_api" as any);
      }
      noProviderConfigured({
        requested_model: `kimi:${resolved_model}`,
        available_providers: listAvailableProviders(),
        disabled_providers: listDisabledProviders(),
        rejection_reasons: ["KIMI_API_KEY / MOONSHOT_API_KEY not set", "Browser Bridge fallback skipped or unavailable"],
      });
    }
    provider = "kimi_api";
    console.log("[router:routeChat:kimi]", { model: resolved_model, request_id });
    try {
      const { resolveKimiApiKey, resolveKimiReasoningEffort, isKimiK3Model, isKimiFamilyModel } = await import("../providers/kimi_api/index.js");
      if (!isKimiFamilyModel(resolved_model)) {
        noProviderConfigured({
          requested_model: `kimi:${resolved_model}`,
          available_providers: listAvailableProviders(),
          disabled_providers: listDisabledProviders(),
          rejection_reasons: [`Model "${resolved_model}" is not a Kimi-family model`],
        });
      }
      const apiKey = resolveKimiApiKey()!;
      const baseURL = process.env.KIMI_API_BASE_URL || "https://api.moonshot.ai/v1";
      const reasoningEffort = isKimiK3Model(resolved_model) ? resolveKimiReasoningEffort("default") : undefined;
      const kimiBody: Record<string, unknown> = {
        model: resolved_model,
        messages: [
          ...(req.system ? [{ role: "system", content: req.system }] : []),
          { role: "user", content: req.message || "" },
        ],
      };
      if (reasoningEffort) {
        kimiBody.reasoning_effort = reasoningEffort;
      }
      const resp = await fetch(`${baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(kimiBody),
        signal: AbortSignal.timeout(120_000),
      });
      const data = await resp.json().catch(() => ({})) as any;
      if (!resp.ok) {
        const errMsg = data?.error?.message || `HTTP ${resp.status}`;
        if (isWebBridgeEnabled()) {
          console.warn(`[router] Kimi API failed (${errMsg}), falling back to Browser Bridge`);
          return await routeWebFallback(req, "kimi_local_web_api" as any);
        }
        providerUnavailable("openai", new Error(errMsg));
      }
      const choice = data?.choices?.[0];
      const text = choice?.message?.content || "";
      const reasoning = choice?.message?.reasoning_content || "";
      const output = reasoning ? `${reasoning}\n\n${text}` : text;
      base = { id: `kimi-${Date.now()}`, model: resolved_model, output, meta: { provider: "kimi_api" as const, model: resolved_model } } as ChatResponse;
    } catch (e) {
      if (isWebBridgeEnabled()) {
        console.warn(`[router] Kimi API failed, falling back to Browser Bridge:`, (e as any)?.message);
        return await routeWebFallback(req, "kimi_local_web_api" as any);
      }
      providerUnavailable("openai", e);
    }
  } else if (model.startsWith("zyloo:") || model.startsWith("zyloo/")) {
    resolved_model = model.startsWith("zyloo:") ? stripPrefix(model, "zyloo:") : model.replace(/^zyloo\//, "");
    const hasZylooKey = Boolean((process.env.ZYLOO_API_KEY || process.env.ZYLOO_API_KEY_2 || "").trim());
    if (!hasZylooKey) {
      noProviderConfigured({
        requested_model: `zyloo:${resolved_model}`,
        available_providers: listAvailableProviders(),
        disabled_providers: listDisabledProviders(),
        rejection_reasons: ["ZYLOO_API_KEY / ZYLOO_API_KEY_2 not set"],
      });
    }
    provider = "zyloo_api";
    console.log("[router:routeChat:zyloo]", { model: resolved_model, request_id });
    try {
      const { resolveZylooApiKeyWithSlot, isZylooModel } = await import("../providers/zyloo_api/index.js");
      if (!isZylooModel(resolved_model)) {
        noProviderConfigured({
          requested_model: `zyloo:${resolved_model}`,
          available_providers: listAvailableProviders(),
          disabled_providers: listDisabledProviders(),
          rejection_reasons: [`Model "${resolved_model}" is not a Zyloo model`],
        });
      }
      const keyWithSlot = resolveZylooApiKeyWithSlot()!;
      const baseURL = "https://api.zyloo.io/v1";
      const zylooBody: Record<string, unknown> = {
        model: resolved_model,
        messages: [
          ...(req.system ? [{ role: "system", content: req.system }] : []),
          { role: "user", content: req.message || "" },
        ],
      };
      const zylooT0 = Date.now();
      const resp = await fetch(`${baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${keyWithSlot.key}`,
        },
        body: JSON.stringify(zylooBody),
        signal: AbortSignal.timeout(120_000),
      });
      const zylooLatencyMs = Date.now() - zylooT0;
      const data = await resp.json().catch(() => ({})) as any;
      if (!resp.ok) {
        const errMsg = data?.error?.message || `HTTP ${resp.status}`;
        const { classifyError, recordProviderFailure } = await import("./provider-failure-policy.js");
        const decision = classifyError(errMsg, resp.status, keyWithSlot.slot === "primary" ? 1 : 0);
        console.log("[router:routeChat:zyloo:error]", {
          model: resolved_model,
          httpStatus: resp.status,
          failureType: decision.type,
          safeMessage: decision.safeMessage,
          shouldFallback: decision.shouldFallback,
        });
        recordProviderFailure("zyloo_api", resolved_model, decision);
        healthRecordFailure("zyloo_api", decision, zylooLatencyMs, Date.now());
        const err = new Error(decision.safeMessage);
        (err as any).code = decision.type === "quota_exhausted" ? "QUOTA_EXHAUSTED" : "PROVIDER_UNAVAILABLE";
        (err as any).statusCode = decision.type === "auth" ? 401 : decision.type === "rate_limit" ? 429 : decision.type === "quota_exhausted" ? 402 : 502;
        (err as any).provider = "zyloo_api";
        (err as any).failureType = decision.type;
        (err as any).shouldFallback = decision.shouldFallback;
        throw err;
      }
      const choice = data?.choices?.[0];
      const text = choice?.message?.content || "";
      healthRecordSuccess("zyloo_api", zylooLatencyMs, Date.now());
      base = { id: `zyloo-${Date.now()}`, model: resolved_model, output: text, meta: { provider: "zyloo_api" as const, model: resolved_model } } as ChatResponse;
    } catch (e: any) {
      if (e.failureType) throw e;
      providerUnavailable("zyloo_api", e);
    }
  } else if (model.startsWith("local:")) {
    provider = "local";
    resolved_model = stripPrefix(model, "local:");

    // local:auto — smart automatic model selection
    if (resolved_model === "auto") {
      try {
        writeLocalProviderEvidence("local_provider_selected", "auto", "Auto Selector", "ollama");
        const autoResult = await callLocalAuto(req.message || "", req.system);
        base = { reply: autoResult.text, meta: { provider: "local" as const, model: autoResult.selectedModel, autoIntent: autoResult.intent, usedFallback: autoResult.usedFallback } } as unknown as ChatResponse;
      } catch (e) {
        if (isWebBridgeEnabled()) {
          console.warn(`[router] local:auto failed, falling back to Web Bridge:`, (e as any)?.message);
          return await routeWebFallback(req);
        }
        providerUnavailable("local", e);
      }
    } else {
    // Check if this is a known local model from the registry (Ollama/LM Studio)
    const knownLocalModel = getLocalModel(resolved_model);
    if (knownLocalModel) {
      writeLocalProviderEvidence("local_provider_selected", knownLocalModel.id, knownLocalModel.name, knownLocalModel.transport);
      try {
        writeLocalProviderEvidence("local_model_response_started", knownLocalModel.id, knownLocalModel.name, knownLocalModel.transport);
        const localResult = await callLocalProvider({
          providerId: resolved_model,
          prompt: req.message || "",
          system: req.system,
        });
        writeLocalProviderEvidence("local_model_response_completed", knownLocalModel.id, knownLocalModel.name, knownLocalModel.transport, { latency_ms: Date.now() - t0 });
        base = { reply: localResult.text, meta: { provider: "local" as const, model: knownLocalModel.id, raw: localResult.raw } } as unknown as ChatResponse;
      } catch (e) {
        writeLocalProviderEvidence("local_model_response_failed", knownLocalModel.id, knownLocalModel.name, knownLocalModel.transport, { error: (e as any)?.message });
        if (isWebBridgeEnabled()) {
          console.warn(`[router] Local model ${resolved_model} failed, falling back to Web Bridge:`, (e as any)?.message);
          return await routeWebFallback(req);
        }
        providerUnavailable("local", e);
      }
    } else if (resolved_model === "local-demo") {
      // local-demo should work without any env vars
      try {
        base = await localDemo({ ...req, model: "local-demo" });
      } catch (e) {
        providerUnavailable("local", e);
      }
    } else {
      // For other local models, we need LOCAL_* env vars
      if (!hasLocal()) {
        if (isWebBridgeEnabled()) {
          console.warn(`[router] Local provider not configured, falling back to Web Bridge`);
          return await routeWebFallback(req);
        }
        noProviderConfigured({
          requested_model: `local:${resolved_model}`,
          available_providers: listAvailableProviders(),
          disabled_providers: listDisabledProviders(),
          rejection_reasons: [
            "TELEGPT_LOCAL_ENABLED=false or LOCAL_OPENAI_BASE_URL/MODEL not set",
            "Web Bridge fallback skipped or unavailable",
          ],
        });
      }
      try {
        base = await localChat({ ...req, model: resolved_model });
      } catch (e) {
        if (isWebBridgeEnabled()) {
          console.warn(`[router] Local provider failed, falling back to Web Bridge:`, (e as any)?.message);
          return await routeWebFallback(req);
        }
        providerUnavailable("local", e);
      }
    }
  }
  } else {
    // Unknown model — try web bridge first, fall back to local-demo only as last resort
    if (isWebBridgeEnabled()) {
      console.warn(`[router] Unknown model "${model}", falling back to Web Bridge`);
      return await routeWebFallback(req);
    }
    provider = "local";
    resolved_model = "local-demo";
    // Default model is local-demo, should work without env vars
    try {
      base = await localDemo({ ...req, model: "local-demo" });
    } catch (e) {
      providerUnavailable("local", e, {
        requested_model: model,
        bridge_enabled: isWebBridgeEnabled(),
      });
    }
  }

  const usage =
    base.meta?.usage ??
    (base.usage
      ? {
          tokens_in: base.usage.inputTokens,
          tokens_out: base.usage.outputTokens,
        }
      : undefined);

  collectEvidence({
    provider: provider as any,
    model: resolved_model,
    intent: (req as any).meta?.intent || "unknown",
    latencyMs: Date.now() - t0,
    success: true,
    fallbackUsed: Boolean(base.meta?.fallback),
    tokensIn: usage?.tokens_in,
    tokensOut: usage?.tokens_out,
  });

  return {
    ...base,
    request_id,
    latency_ms: Date.now() - t0,
    meta: {
      ...(base.meta || {}),
      provider,
      model: resolved_model,
      usage,
    },
  };
}
