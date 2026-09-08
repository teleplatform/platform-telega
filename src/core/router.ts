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
import { recordSuccess as healthRecordSuccess, recordFailure as healthRecordFailure, isProviderEligible, getSnapshot } from "./provider-health-runtime.js";
import { planProviderSelection, capabilityRegistry, ALL_CAPABILITIES, type Capability } from "./provider-capability-registry.js";
import { selectProvider, buildProviderCandidates, ProviderSelectionError, type ProviderRouteIntent, type ProviderSelectionPlan, type SelectionRejectionReason } from "./provider-selection-orchestrator.js";
import { evaluateProviderQuality, normalizeTaskType, type ProviderQualityEvaluationInput, type TaskType } from "./provider-quality-runtime.js";
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

function localAutoUnavailable(diagnostics?: {
  requested_model?: string;
  available_providers?: string[];
  disabled_providers?: string[];
}): never {
  const err = new Error("Local automatic model selection is unavailable");
  (err as any).code = "LOCAL_AUTO_UNAVAILABLE";
  (err as any).statusCode = 503;
  (err as any).failureType = "invalid_request";
  (err as any).shouldFallback = false;
  (err as any).errorType = "server_error";
  (err as any).hint =
    "model \"local:auto\" is not supported; use an explicit model (e.g. local-demo, local:local-chat, or a concrete local model)";
  (err as any).diagnostics = {
    requested_model: diagnostics?.requested_model ?? "local:auto",
    available_providers:
      diagnostics?.available_providers ?? listAvailableProviders(),
    disabled_providers:
      diagnostics?.disabled_providers ?? listDisabledProviders(),
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

/**
 * TGP-17C — derive required capabilities from a request.
 * Declarative: the request states WHAT it needs; the Capability Registry
 * decides WHO can do it. Fail-open: empty list means "no constraint".
 */
function deriveRequiredCapabilities(req: ChatRequest): Capability[] {
  const required = new Set<Capability>();
  if (Array.isArray(req.tools) && req.tools.length > 0) {
    required.add("tools");
    required.add("function_calling");
  }
  if (req.task?.type === "reasoning" || req.task?.type === "deep_reasoning") {
    required.add("reasoning");
  }
  if (req.task?.type === "code" || req.task?.type === "coding") {
    required.add("code");
  }
  if (req.task?.type === "vision" || req.task?.type === "image") {
    required.add("vision");
  }
  if (typeof req.meta?.long_context === "boolean" && req.meta.long_context) {
    required.add("long_context");
  }
  if (Array.isArray((req as any).meta?.capabilities)) {
    for (const c of (req as any).meta.capabilities as string[]) {
      if (ALL_CAPABILITIES.includes(c as Capability)) {
        required.add(c as Capability);
      }
    }
  }
  return [...required];
}

async function routeWithProvider(req: ChatRequest, modelOverride: string): Promise<ChatResponse> {
  const reroute = { ...req, model: modelOverride };
  return await routeChat(reroute);
}

/**
 * TGP-17D — Unified execution with orchestrator fallback plan.
 * 1. Parse model string → ProviderRouteIntent
 * 2. Build selection plan (capability → health → scoring)
 * 3. Execute selected provider
 * 4. On failure, iterate through fallbackOrder
 * 5. All failures classified via ProviderFailurePolicy
 */
async function executeWithOrchestrator(
  req: ChatRequest,
  model: string,
  request_id: string,
  t0: number,
): Promise<ChatResponse> {
  const requiredCaps = deriveRequiredCapabilities(req);
  const options = { requiredCapabilities: requiredCaps, requestId: request_id };
  let plan: any;

  try {
    plan = selectProvider(model, options);
  } catch (e: any) {
    if (e instanceof ProviderSelectionError) {
      const err = new Error(e.message);
      (err as any).code = e.code;
      (err as any).statusCode = e.statusCode;
      (err as any).details = e.details;
      throw err;
    }
    throw e;
  }

  const { selectedProviderId, selectedModel, fallbackOrder } = plan;
  if (!selectedProviderId) {
    const err = new Error("No provider selected");
    (err as any).code = "NO_ELIGIBLE_PROVIDER";
    (err as any).statusCode = 503;
    throw err;
  }

  // Resolve model name: use requested model if specified, else default
  const resolvedModel = selectedModel || plan.intent.requestedModel || "";

  // Execute with fallback chain
  let lastError: any;
  const attemptOrder = [selectedProviderId, ...fallbackOrder];

  for (const providerId of attemptOrder) {
    try {
      const base = await executeProvider(providerId, resolvedModel, req, request_id, t0);
      // Success — record evidence with selection result
      collectEvidence({
        provider: providerId as any,
        model: resolvedModel || providerId,
        intent: (req as any).meta?.intent || "unknown",
        latencyMs: Date.now() - t0,
        success: true,
        fallbackUsed: providerId !== selectedProviderId,
      });
      
      // TGP-18A — Quality evaluation (non-fatal side channel)
      try {
        const taskType = normalizeTaskType((req as any).meta?.task?.type || "chat");
        await evaluateProviderQuality({
          providerId,
          modelId: resolvedModel || providerId,
          taskType,
          requestId: request_id,
          executionOk: true,
          retryCount: 0, // TODO: track retries from selection plan
          fallbackUsed: providerId !== selectedProviderId,
          taskCompleted: true,
          completionQuality: "full",
          latencyMs: Date.now() - t0,
          timestamp: Date.now(),
        });
      } catch {
        // Non-fatal: quality evaluation must never break the response
      }

      return {
        ...base,
        request_id,
        latency_ms: Date.now() - t0,
        meta: {
          ...(base.meta || {}),
          provider: providerId,
          model: resolvedModel || providerId,
        },
      };
    } catch (e: any) {
      lastError = e;
      // TGP-18A — Quality evaluation for failed execution (non-fatal)
      try {
        const taskType = normalizeTaskType((req as any).meta?.task?.type || "chat");
        await evaluateProviderQuality({
          providerId,
          modelId: resolvedModel || providerId,
          taskType,
          requestId: request_id,
          executionOk: false,
          failureType: e.failureType,
          retryCount: 0,
          fallbackUsed: providerId !== selectedProviderId,
          taskCompleted: false,
          completionQuality: "none",
          latencyMs: Date.now() - t0,
          timestamp: Date.now(),
        });
      } catch {
        // Non-fatal
      }
      // If the error has a failureType from ProviderFailurePolicy, classify and decide fallback
      if (e.failureType && e.shouldFallback === false) {
        throw e; // Terminal error per failure policy
      }
      console.warn(`[orchestrator] Provider ${providerId} failed, trying next fallback`, {
        error: e.message,
        failureType: e.failureType,
        remaining: fallbackOrder.filter((p: string) => p !== providerId),
      });
      // Continue to next fallback
    }
  }

  // All attempts exhausted
  const err = new Error(lastError?.message || "All provider attempts exhausted");
  (err as any).code = "SELECTION_PLAN_EXHAUSTED";
  (err as any).statusCode = 503;
  (err as any).details = {
    mode: plan.intent.mode,
    requestedProviderId: plan.intent.requestedProviderId,
    requiredCapabilities: plan.requiredCapabilities,
    consideredProviderIds: plan.consideredProviders,
    rejectionReasonCodes: [...plan.capabilityRejected.map((r: any) => r.reason), ...plan.healthRejected.map((r: any) => r.reason)],
    lastError: lastError?.message,
  };
  throw err;
}

/**
 * Execute a single provider by providerId and model.
 * Returns the base ChatResponse from the provider.
 */
async function executeProvider(
  providerId: string,
  model: string,
  req: ChatRequest,
  request_id: string,
  t0: number,
): Promise<ChatResponse> {
  switch (providerId) {
    case "openai_api":
      return await openaiChat({ ...req, model });
    case "deepseek_api":
      return await deepseekChat({ ...req, model });
    case "qwen_api":
      return await qwenChat({ ...req, model });
    case "kimi_api": {
      const { resolveKimiApiKey, resolveKimiReasoningEffort, isKimiK3Model, isKimiFamilyModel } = await import("../providers/kimi_api/index.js");
      if (!isKimiFamilyModel(model)) {
        throw new Error(`Model "${model}" is not a Kimi-family model`);
      }
      const apiKey = resolveKimiApiKey()!;
      const baseURL = process.env.KIMI_API_BASE_URL || "https://api.moonshot.ai/v1";
      const reasoningEffort = isKimiK3Model(model) ? resolveKimiReasoningEffort("default") : undefined;
      const kimiBody: Record<string, unknown> = {
        model,
        messages: [
          ...(req.system ? [{ role: "system", content: req.system }] : []),
          { role: "user", content: req.message || "" },
        ],
      };
      if (reasoningEffort) kimiBody.reasoning_effort = reasoningEffort;
      const resp = await fetch(`${baseURL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify(kimiBody),
        signal: AbortSignal.timeout(120_000),
      });
      const data = await resp.json().catch(() => ({})) as any;
      if (!resp.ok) {
        const errMsg = data?.error?.message || `HTTP ${resp.status}`;
        const { classifyError, recordProviderFailure } = await import("./provider-failure-policy.js");
        const decision = classifyError(errMsg, resp.status, 1); // assume primary slot for non-zyloo
        recordProviderFailure("kimi_api", model, decision);
        healthRecordFailure("kimi_api", decision, Date.now() - t0, Date.now());
        const err = new Error(decision.safeMessage);
        (err as any).code = decision.type === "quota_exhausted" ? "QUOTA_EXHAUSTED" : "PROVIDER_UNAVAILABLE";
        (err as any).statusCode = decision.type === "auth" ? 401 : decision.type === "rate_limit" ? 429 : decision.type === "quota_exhausted" ? 402 : 502;
        (err as any).provider = "kimi_api";
        (err as any).failureType = decision.type;
        (err as any).shouldFallback = decision.shouldFallback;
        throw err;
      }
      const choice = data?.choices?.[0];
      const text = choice?.message?.content || "";
      const reasoning = choice?.message?.reasoning_content || "";
      const output = reasoning ? `${reasoning}\n\n${text}` : text;
      healthRecordSuccess("kimi_api", Date.now() - t0, Date.now());
      return { id: `kimi-${Date.now()}`, model, output, meta: { provider: "kimi_api" as const, model } } as ChatResponse;
    }
    case "zyloo_api": {
      const { resolveZylooApiKeyWithSlot, isZylooModel } = await import("../providers/zyloo_api/index.js");
      if (!isZylooModel(model)) {
        throw new Error(`Model "${model}" is not a Zyloo model`);
      }
      const keyWithSlot = resolveZylooApiKeyWithSlot()!;
      const baseURL = "https://api.zyloo.io/v1";
      const zylooBody: Record<string, unknown> = {
        model,
        messages: [
          ...(req.system ? [{ role: "system", content: req.system }] : []),
          { role: "user", content: req.message || "" },
        ],
      };
      const zylooT0 = Date.now();
      const resp = await fetch(`${baseURL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${keyWithSlot.key}` },
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
          model, httpStatus: resp.status, failureType: decision.type,
          safeMessage: decision.safeMessage, shouldFallback: decision.shouldFallback,
        });
        recordProviderFailure("zyloo_api", model, decision);
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
      return { id: `zyloo-${Date.now()}`, model, output: text, meta: { provider: "zyloo_api" as const, model } } as ChatResponse;
    }
    case "local": {
      // local:auto is a recursive self-routing seam (routeChat →
      // executeWithOrchestrator → executeProvider → routeWithProvider →
      // routeChat). Fail closed instead of recursing.
      if (model === "auto") {
        return localAutoUnavailable({ requested_model: `${providerId}:auto` });
      }
      const knownLocalModel = getLocalModel(model);
      if (knownLocalModel) {
        writeLocalProviderEvidence("local_provider_selected", knownLocalModel.id, knownLocalModel.name, knownLocalModel.transport);
        try {
          writeLocalProviderEvidence("local_model_response_started", knownLocalModel.id, knownLocalModel.name, knownLocalModel.transport);
          const localResult = await callLocalProvider({ providerId: model, prompt: req.message || "", system: req.system });
          writeLocalProviderEvidence("local_model_response_completed", knownLocalModel.id, knownLocalModel.name, knownLocalModel.transport, { latency_ms: Date.now() - t0 });
          return { reply: localResult.text, meta: { provider: "local" as const, model: knownLocalModel.id, raw: localResult.raw } } as unknown as ChatResponse;
        } catch (e) {
          writeLocalProviderEvidence("local_model_response_failed", knownLocalModel.id, knownLocalModel.name, knownLocalModel.transport, { error: (e as any)?.message });
          throw e;
        }
      }
      if (model === "local-demo") {
        return await localDemo({ ...req, model: "local-demo" });
      }
      // Fallback to localChat for other models
      return await localChat({ ...req, model });
    }
    default:
      // Unknown provider — should not happen if capability filter works
      throw new Error(`Unknown provider: ${providerId}`);
  }
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

    // TGP-17C — capability pre-filter: narrow candidate set to providers that
    // can actually fulfill the declared request capabilities. This runs BEFORE
    // health/scoring/intent selection and never blocks routing (fail-open).
    const requiredCaps = deriveRequiredCapabilities(req);
    const candidatePool = capabilityRegistry.listProviders();
    const plan = planProviderSelection(candidatePool, requiredCaps);
    const capableCandidates = plan.capabilityEligible;
    if (plan.capabilityExcluded.length > 0) {
      console.log("[tgp17c:capability_filter]", {
        required: requiredCaps,
        excluded: plan.capabilityExcluded.map((e) => ({ provider: e.providerId, missing: e.missing })),
        capable_count: capableCandidates.length,
      });
    }

    const decision = await autoRoute(req.message || "", {
      selectedProvider: (activeProviderId as any) || (plan.selected as any),
    });
    console.log("[auto_router:v2] selected", {
      provider: decision.selectedProvider,
      intent: decision.intent,
      score: decision.score,
      capability_filtered: requiredCaps.length > 0,
    });

    // Pass intent + capability plan through to evidence collection
    (req as any).meta = {
      ...(req as any).meta,
      intent: decision.intent,
      capability_required: requiredCaps,
      capability_excluded: plan.capabilityExcluded.map((e) => e.providerId),
      capability_eligible: plan.capabilityEligible,
    };
    const selectedRoute = decision.selectedProvider === "local"
      ? "local:auto"
      : `${decision.selectedProvider}:${decision.selectedModel || decision.selectedProvider}`;
    return await routeWithProvider(req, selectedRoute);
  }

  // TGP-17D — Unified provider selection via orchestrator
  // All explicit provider routes (kimi:, zyloo:, openai:, deepseek:, qwen:, local:)
  // go through the capability → health → scoring pipeline with fallback plan.
  if (!model.startsWith("openai_web:") && !model.startsWith("deepseek_web:") &&
      !model.startsWith("qwen_web:") && !model.startsWith("kimi_web:") &&
      !model.startsWith("gemini_web:") && !model.startsWith("chatgpt") &&
      !model.startsWith("openai_web") && !model.startsWith("deepseek_web") &&
      !model.startsWith("qwen_web") && !model.startsWith("kimi_web") &&
      !model.startsWith("gemini_web")) {
    return await executeWithOrchestrator(req, model, request_id, t0);
  }

  // Unknown model — try web bridge first, fall back to local-demo only as last resort
  if (isWebBridgeEnabled()) {
    console.warn(`[router] Unknown model "${model}", falling back to Web Bridge`);
    return await routeWebFallback(req);
  }
  provider = "local";
  resolved_model = "local-demo";
  try {
    base = await localDemo({ ...req, model: "local-demo" });
  } catch (e) {
    providerUnavailable("local", e, {
      requested_model: model,
      bridge_enabled: isWebBridgeEnabled(),
    });
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
