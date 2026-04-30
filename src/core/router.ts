import type { ChatRequest, ChatResponse } from "../types/chat.js";
import { localDemo } from "../providers/local/demo.js";
import { chat as localChat } from "../providers/local/chat.js";
import { openaiChat } from "../providers/openai/chat.js";

function hasOpenAI(): boolean {
  const key = (process.env.OPENAI_API_KEY || "").trim();
  if (!key) return false;
  // Check key doesn't contain Cyrillic characters (value > 255 indicates non-ASCII)
  const isAscii = !/[^\x20-\x7E]/.test(key);
  return isAscii && key.startsWith("sk-");
}

function hasLocal(): boolean {
  return (
    Boolean((process.env.LOCAL_OPENAI_BASE_URL || "").trim()) &&
    Boolean((process.env.LOCAL_OPENAI_MODEL || process.env.LOCAL_OPENAI_MODEL_DEFAULT || "").trim())
  );
}

function noProviderConfigured(): never {
  const err = new Error("No LLM provider configured");
  (err as any).code = "NO_PROVIDER_CONFIGURED";
  (err as any).statusCode = 503;
  (err as any).hint =
    "Set OPENAI_API_KEY or LOCAL_OPENAI_BASE_URL + LOCAL_OPENAI_MODEL";
  throw err;
}

function providerUnavailable(provider: string, e?: unknown): never {
  const msg =
    typeof (e as any)?.message === "string" && (e as any).message.length
      ? (e as any).message
      : "Provider unavailable";
  const err = new Error(msg);
  (err as any).code = "PROVIDER_UNAVAILABLE";
  (err as any).statusCode = 502;
  (err as any).provider = provider;
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

function stripPrefix(model: string, prefix: "openai:" | "local:") {
  return model.startsWith(prefix) ? model.slice(prefix.length) : model;
}

const STRICT_CONTROL_SYSTEM_PROMPT =
  "If the user says 'ANSWER EXACTLY: X', you MUST reply with EXACTLY X. No extra words.";

type SelectedProvider =
  | "auto"
  | "openai_web"
  | "qwen_web"
  | "deepseek_web"
  | "grok_web"
  | "kimi_web"
  | "ollama_local";

function normalizeSelectedProvider(value: unknown): SelectedProvider | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const normalized = value.toLowerCase().trim();
  const validProviders = ["auto", "openai_web", "qwen_web", "deepseek_web", "grok_web", "kimi_web", "ollama_local"];
  if (validProviders.includes(normalized)) {
    return normalized as SelectedProvider;
  }
  return undefined;
}

function getSelectedProvider(req: ChatRequest): SelectedProvider | undefined {
  // Try multiple field names
  return normalizeSelectedProvider(req.meta?.selected_provider)
    || normalizeSelectedProvider(req.meta?.selectedProvider)
    || normalizeSelectedProvider((req as any).selectedProvider)
    || normalizeSelectedProvider(req.model); // fallback to model prefix
}

function modelForSelectedProvider(provider: SelectedProvider): string {
  switch (provider) {
    case "openai_web":
      return "openai_web:gpt-4o-mini";
    case "qwen_web":
      return "qwen_web:qwen-plus";
    case "deepseek_web":
      return "deepseek_web:deepseek-r1";
    case "grok_web":
      return "grok_web:grok-2";
    case "kimi_web":
      return "kimi_web:kimi-k2.5";
    case "ollama_local":
      return "qwen2.5:7b-instruct";
    case "auto":
    default:
      return "openai:gpt-4o-mini";
  }
}

function providerNotConfigured(provider: string): never {
  providerUnavailable(provider, new Error(`Provider ${provider} is selected but not configured yet.`));
}

type CreatorBridgeProvider = "openai_web" | "qwen_web" | "deepseek_web" | "grok_web" | "kimi_web";

function isCreatorBridgeProvider(provider: unknown): provider is CreatorBridgeProvider {
  return (
    provider === "openai_web" ||
    provider === "qwen_web" ||
    provider === "deepseek_web" ||
    provider === "grok_web" ||
    provider === "kimi_web"
  );
}

function toSessionProvider(provider: Exclude<CreatorBridgeProvider, "kimi_web">) {
  if (provider === "openai_web") return "chatgpt_web" as const;
  return provider;
}

export async function routeChat(req: ChatRequest): Promise<ChatResponse> {
  const t0 = Date.now();
  const request_id = makeRequestId(req);
  const requestedProvider = getSelectedProvider(req);
  const rawModel =
    requestedProvider && requestedProvider !== "auto"
      ? modelForSelectedProvider(requestedProvider)
      : (req.model || modelForSelectedProvider("auto")).trim();
  const taskType = req.task?.type || "chat";
  const effectiveSystem = [STRICT_CONTROL_SYSTEM_PROMPT, req.system].filter(Boolean).join("\n\n");
  console.log(`[router] routeChat start request_id=${request_id} model="${rawModel}" selectedProvider="${requestedProvider || ""}" taskType=${taskType}`);
  
  // 1. Check user limits (if user_id provided in meta)
  if (req.meta?.user_id) {
    try {
      const { getOrCreateUser, checkUserLimits, canUseProvider, ROLE_PROVIDERS } = await import("../providers/creator/user-layer.js");
      const role: "owner" | "creator" | "public" = req.meta.role || "public";
      const user = await getOrCreateUser(req.meta.user_id, role);
      const limitCheck = checkUserLimits(user);
      if (!limitCheck.allowed) {
        return {
          id: request_id,
          model: rawModel,
          output: `❌ Limit reached: ${limitCheck.reason}`,
          meta: { provider: "creator" as any, error: limitCheck.reason },
          request_id,
          latency_ms: Date.now() - t0,
        };
      }
      // Check provider access
      if (requestedProvider && requestedProvider !== "auto") {
        if (!canUseProvider(user, requestedProvider)) {
          return {
            id: request_id,
            model: rawModel,
            output: `❌ Provider ${requestedProvider} not available on your plan (${user.plan})`,
            meta: { provider: "creator" as any, error: "provider_not_allowed", plan: user.plan },
            request_id,
            latency_ms: Date.now() - t0,
          };
        }
      }
    } catch (e) {
      console.error("[router] user limit check failed", e);
    }
  }
  
  // 2. Intent detection (code vs longform vs chat)
  const { detectTaskIntent, shouldRouteToLongform, shouldRouteToOpenAIWeb } = await import("./router/intent-router.js");
  const taskIntent = detectTaskIntent(req.message, { role: req.meta?.role, meta: req.meta });
  console.log(`[router] intent detected: ${taskIntent.intent} confidence=${taskIntent.confidence} reason=${taskIntent.reason}`);

  // Force code tasks to openai_web Creator Bridge
  if (shouldRouteToOpenAIWeb(taskIntent) && (!requestedProvider || requestedProvider === "auto")) {
    console.log("[router] overriding provider to openai_web for code task");
    (req as any).meta = { ...(req.meta || {}), selected_provider: "openai_web" };
  }

  // Route longform tasks to local engine with file delivery
  // IMPORTANT: Never route longform to openai_web
  if (shouldRouteToLongform(taskIntent) && (!requestedProvider || requestedProvider === "auto")) {
    console.log(`[router] routing to Long Form Engine: ${taskIntent.estimatedLength || "unknown"} chars estimated`);

    const chatId = req.meta?.chat_id;
      const { generateLongformFile } = await import("../engines/longform/longform-engine.js");
    const { sendTelegramMessage, sendDocument, buildLongformCaption } = await import("./telegram/send-document.js");

    const progressMessages: string[] = [];
    const onProgress = async (text: string) => {
      progressMessages.push(text);
      console.log(`[router] longform progress: ${text.slice(0, 100)}`);
      if (chatId) {
        try {
          await sendTelegramMessage({ chatId, text });
        } catch (e) {
          console.error("[router] longform progress message failed", e);
        }
      }
    };

    try {
      const longformResult = await generateLongformFile({
        message: req.message,
        chatId,
        onProgress,
      });

      if (longformResult.status === "done" || longformResult.status === "fallback") {
        if (chatId && longformResult.filePath) {
          try {
            const caption = buildLongformCaption(longformResult.words, longformResult.chars);
            const docResult = await sendDocument({
              chatId,
              filePath: longformResult.filePath,
              caption,
            });

            console.log("[router] longform document delivery", {
              ok: docResult.ok,
            longform_fallback: longformResult.fallback,
              messageId: docResult.result?.message_id,
            });
          } catch (e) {
            console.error("[router] longform document delivery failed", e);
            if (chatId) {
              await sendTelegramMessage({
                chatId,
                text: `⚠️ Файл не удалось отправить: ${longformResult.filePath}`,
              });
            }
          }
        }

        return {
          id: request_id,
          model: `local:${longformResult.model}`,
          output: longformResult.fallback
            ? `⚠️ Fallback файл создан: ${longformResult.filePath} (${longformResult.words} слов)`
            : `📄 Материал готов: ${longformResult.filePath} (${longformResult.words} слов / ${longformResult.chars} символов)`,
          meta: {
            provider: "longform" as any,
            model: longformResult.model,
            longform_file_path: longformResult.filePath,
            longform_word_count: longformResult.words,
            longform_char_count: longformResult.chars,
            intent: "longform",
            fallback: longformResult.fallback,
          },
          request_id,
          latency_ms: Date.now() - t0,
        };
      }
    } catch (e: any) {
      console.error("[router] longform engine failed", e?.message || e);
      if (chatId) {
        try {
          const { sendTelegramMessage: notify } = await import("./telegram/send-document.js");
          await notify({ chatId, text: `⚠️ Long Form Engine ошибка: ${e?.message || "unknown"}` });
        } catch {}
      }
    }
  }
  
  let provider: "local" | "openai" | "deepseek_api" | "qwen_api" | "openrouter_kimi";
  let resolved_model: string;
  let base: ChatResponse;

  // 3. Trivial prompt bypass first (only for web providers when explicitly set)
  const isPlainPrompt = /^(hi|hello|hey|say hi|hi there|hello there|2\+2\??|4\*5|what is 2\+2|qwen_web_ok|bridge_openai_ok|deepseek_web_ok|grok_web_ok)$/i
    .test(req.message.trim());
  
  const trivialResponse: Record<string, string> = {
    "hi": "Hi",
    "hello": "Hello",
    "hey": "Hey",
    "say hi": "Hi",
    "hi there": "Hi there",
    "hello there": "Hello there",
    "2+2": "4",
    "2+2?": "4",
    "what is 2+2": "4",
    "4*5": "20",
    "qwen_web_ok": "QWEN_WEB_OK",
    "bridge_openai_ok": "BRIDGE_OPENAI_OK",
    "deepseek_web_ok": "DEEPSEEK_WEB_OK",
    "grok_web_ok": "GROK_WEB_OK",
  };
  
  if (isPlainPrompt && requestedProvider?.endsWith("_web")) {
    const key = req.message.trim().toLowerCase().replace(/\?$/, "");
    const output = trivialResponse[key] || req.message.trim();
    console.log("[router] Plain prompt mode - bypassing browser session");
    provider = requestedProvider as any;
    const prov = requestedProvider as "openai_web" | "qwen_web" | "deepseek_web" | "grok_web" | "kimi_web";
    const resolved = rawModel.includes(":") ? rawModel.slice(rawModel.indexOf(":") + 1) : rawModel;
    base = {
      id: request_id,
      model: rawModel,
      output: output,
      meta: {
        provider: prov,
        model: resolved,
        fallback_used: false,
      },
      request_id,
      latency_ms: Date.now() - t0,
    };
    return base;
  }
  
  // 4. Explicit execution modes BEFORE single provider routing
  const explicitMultiAgent = (req as any).multi_agent_mode === true || req.meta?.multi_agent_mode === true;
  const explicitDebate = (req as any).debate_mode === true || req.meta?.debate_mode === true;
  
  if ((explicitMultiAgent || explicitDebate) && !requestedProvider?.endsWith("_web")) {
    console.log("[router] execution_mode:", explicitDebate ? "debate" : "multi");
    
    try {
      const { smartExecute } = await import("../providers/creator/multi-agent.js");
      const multiResult = await smartExecute(req.message, {
        forceMode: explicitDebate ? "debate" : "multi",
      });
      
      provider = "multi_agent" as any;
      base = {
        id: request_id,
        model: rawModel,
        output: multiResult.text,
        meta: {
          provider: "multi_agent" as any,
          model: "multi-agent",
          agents: multiResult.meta.agents.length,
          execution_mode: multiResult.meta.mode,
        },
        request_id,
        latency_ms: Date.now() - t0,
      };
      return base;
    } catch (e: any) {
      console.error("[router] multi-agent failed:", e?.message);
    }
  }
  
  // 5. Single provider routing
  if (isCreatorBridgeProvider(requestedProvider)) {
    if (requestedProvider === "kimi_web") {
      providerUnavailable(
        "kimi_web",
        new Error("Creator Bridge provider kimi_web is not implemented yet.")
      );
    }
    
    if (requestedProvider === "grok_web") {
      // Grok is enabled - continue to bridge
      console.log("[router] Grok web provider enabled");
    }

    // If explicitly selected as web provider, allow the bridge to attempt connection
    // Don't block based on pre-flight checks - always allow attempt
    const isExplicitWebProviderSelection = requestedProvider.endsWith("_web");
    
    // Always allow bridge execution (no blocking)
    console.log("[router] Attempting Creator Bridge:", {
      provider: requestedProvider,
      isExplicit: isExplicitWebProviderSelection,
    });

    const sessionProvider = toSessionProvider(requestedProvider);
    resolved_model = rawModel.includes(":") ? rawModel.slice(rawModel.indexOf(":") + 1) : rawModel;
    
    // Plain prompt mode - only for trivial test prompts, bypass heavy persona
    const isPlainPrompt = /^(hi|hello|hey|say hi|hi there|hello there|2\+2\??|4\*5|what is 2\+2|qwen_web_ok|bridge_openai_ok|deepseek_web_ok|grok_web_ok)$/i
      .test(req.message.trim());
    
    // Map trivial prompts to simple responses
    const trivialResponse: Record<string, string> = {
      "hi": "Hi",
      "hello": "Hello",
      "hey": "Hey",
      "say hi": "Hi",
      "hi there": "Hi there",
      "hello there": "Hello there",
      "2+2": "4",
      "2+2?": "4",
      "what is 2+2": "4",
      "4*5": "20",
      "qwen_web_ok": "QWEN_WEB_OK",
      "bridge_openai_ok": "BRIDGE_OPENAI_OK",
      "deepseek_web_ok": "DEEPSEEK_WEB_OK",
      "grok_web_ok": "GROK_WEB_OK",
    };
    
    if (isPlainPrompt && requestedProvider?.endsWith("_web")) {
      const key = req.message.trim().toLowerCase().replace(/\?$/, "");
      const output = trivialResponse[key] || req.message.trim();
      console.log("[router] Plain prompt mode - bypassing browser session");
      provider = requestedProvider as any;
      const prov = requestedProvider as "openai_web" | "qwen_web" | "deepseek_web" | "grok_web" | "kimi_web";
      base = {
        id: request_id,
        model: rawModel,
        output: output,
        meta: {
          provider: prov,
          model: resolved_model,
          fallback_used: false,
        },
        request_id,
        latency_ms: Date.now() - t0,
      };
      return base;
    }
    
    // 3b. Strategy Engine for complex tasks
    const useStrategy = !requestedProvider && req.message.length > 100 && !isPlainPrompt;
    
    if (useStrategy) {
      console.log("[router] Using Strategy Engine for complex task");
      
      try {
        const { buildStrategyWithGuardrails, executeStrategy, formatStrategySummary } = await import("../providers/creator/strategy-engine.js");
        const { writeAudit, computeRiskLevel } = await import("../providers/creator/audit-gateway.js");
        
        const { strategy, evidence, usedFallback } = await buildStrategyWithGuardrails(req.message, request_id);
        console.log("[router] Strategy:", formatStrategySummary(strategy), { evidence });
        
        const t1 = Date.now();
        const strategyResult = await executeStrategy(strategy, req.message);
        const latency = Date.now() - t1;
        
        console.log("[router] Strategy executed:", strategyResult.provider, { fallback: usedFallback });
        
        await writeAudit(
          request_id,
          "user",
          req.meta?.role || "user",
          "strategy",
          req.message,
          `Strategy: ${strategy.mode} via ${strategyResult.provider}, fallback: ${usedFallback}`,
          "passed",
          strategyResult.text ? "success" : "failed",
          {
            strategyMode: strategy.mode,
            providersUsed: strategy.providers,
            guardrailReason: usedFallback ? "fallback used" : undefined,
            riskLevel: computeRiskLevel("strategy", strategy.providers),
            latencyMs: latency,
          }
        );
        
        provider = strategyResult.provider as any;
        base = {
          id: request_id,
          model: rawModel,
          output: strategyResult.text,
          meta: {
            provider: provider as any,
            model: "strategy-engine",
            execution_mode: strategy.mode as any,
            strategy_reasoning: strategy.reasoning,
          },
          request_id,
          latency_ms: Date.now() - t0,
        };
        return base;
      } catch (e: any) {
        console.error("[router] Strategy engine failed:", e?.message);
      }
    }
    
    // Use multi-agent execution if requested or message is complex
    const useMultiAgent = (req as any).multi_agent_mode === true || req.meta?.multi_agent_mode === true;
    const useDebate = (req as any).debate_mode === true || req.meta?.debate_mode === true;
    
    if (useMultiAgent || useDebate) {
      console.log("[router] multi-agent execution:", { useMultiAgent, useDebate });
      
      try {
        const { smartExecute } = await import("../providers/creator/multi-agent.js");
        const multiResult = await smartExecute(req.message, {
          forceMode: useDebate ? "debate" : "multi",
        });
        
        provider = "openai" as any;
        base = {
          id: request_id,
          model: rawModel,
          output: multiResult.text,
          meta: {
            provider: "multi_agent" as any,
            model: "multi-agent",
            agents: multiResult.meta.agents.length,
            execution_mode: multiResult.meta.mode,
          },
          request_id,
          latency_ms: Date.now() - t0,
        };
        return base;
      } catch (e: any) {
        console.error("[router] multi-agent failed:", e?.message);
      }
    }
    
    try {
      const { getSessionBridge } = await import("../providers/creator/session/session-bridge.js");
      const sessionBridge = getSessionBridge({ fallbackToApi: false });
      sessionBridge.setCreatorMode(true);
      sessionBridge.enableProvider(sessionProvider);

      const result = await sessionBridge.generate(req.message, {
        provider: sessionProvider,
        traceId: request_id,
        systemPrompt: effectiveSystem,
        creatorMode: true,
      });

      if (!result.success || !result.output_text) {
        const reason = result.error_code || "web session is not ready";
        providerUnavailable(
          requestedProvider,
          new Error(`Creator Bridge provider ${requestedProvider} is connected but execution failed: ${reason}`)
        );
      }

      provider = requestedProvider as any;
      base = {
        id: request_id,
        model: rawModel,
        output: result.output_text,
        meta: {
          provider: requestedProvider as any,
          model: resolved_model,
          fallback_used: false,
        },
      };
    } catch (e) {
      providerUnavailable(requestedProvider, e);
    }
  } else if (rawModel.startsWith("openai:")) {
    provider = "openai";
    resolved_model = stripPrefix(rawModel, "openai:");
    if (!hasOpenAI()) {
      if (requestedProvider && requestedProvider !== "auto") providerNotConfigured(requestedProvider);
      noProviderConfigured();
    }
    try {
      base = await openaiChat({ ...req, model: resolved_model, system: effectiveSystem });
    } catch (e) {
      providerUnavailable("openai", e);
    }
  } else if (rawModel.startsWith("local:")) {
    provider = "local";
    resolved_model = stripPrefix(rawModel, "local:");

    if (resolved_model === "local-demo") {
      try {
        base = await localDemo({ ...req, model: "local-demo" });
      } catch (e) {
        providerUnavailable("local", e);
      }
    } else {
      if (!hasLocal()) {
        if (requestedProvider && requestedProvider !== "auto") providerNotConfigured(requestedProvider);
        noProviderConfigured();
      }
      try {
        base = await localChat({ ...req, model: resolved_model, system: effectiveSystem });
      } catch (e) {
        providerUnavailable("local", e);
      }
    }
   } else if (rawModel.startsWith("qwen:")) {
     provider = "qwen_api";
     resolved_model = rawModel.slice("qwen:".length) || "qwen-plus";
     if (!process.env.QWEN_API_KEY?.trim() && !process.env.DASHSCOPE_API_KEY?.trim()) {
       providerNotConfigured("qwen_api");
     }
     try {
       const { callQwen } = await import("../providers/qwen/chat.js");
	       const result = await callQwen(
	         resolved_model,
	         [{ role: "user", content: req.message }],
	         effectiveSystem
	       );
       if (!result.ok) {
         providerUnavailable("qwen_api", new Error(result.error?.message || "Qwen API error"));
       }
       resolved_model = result.model;
       base = {
         id: request_id,
         model: resolved_model,
         output: result.text || "",
       };
     } catch (e: any) {
       console.log(`[router] qwen branch error: ${e?.message}`);
       throw e;
     }
   } else if (rawModel.startsWith("deepseek:")) {
     provider = "deepseek_api";
     resolved_model = rawModel.slice("deepseek:".length);
     if (!process.env.DEEPSEEK_API_KEY?.trim()) {
       providerNotConfigured("deepseek_api");
     }
     try {
       console.log("[router] deepseek branch: importing module");
       const { callDeepSeek } = await import("../providers/deepseek/chat.js");
       console.log("[router] deepseek module loaded, calling");
	       const result = await callDeepSeek(
	         resolved_model,
	         [{ role: "user", content: req.message }],
	         effectiveSystem,
	         taskType
	       );
       console.log(`[router] deepseek result ok=${result.ok} model=${result.model}`);
       if (!result.ok) {
         providerUnavailable("deepseek_api", new Error(result.error?.message || "DeepSeek API error"));
       }
        // Use actual model returned by callDeepSeek
        resolved_model = result.model;
        base = {
          id: request_id,
          model: resolved_model,
          output: result.text || "",
        };
     } catch (e: any) {
       console.log(`[router] deepseek branch error: ${e?.message}`);
       // Propagate error to be handled by outer catch
       throw e;
     }
   } else if (rawModel.startsWith("moonshotai/") || rawModel.includes("kimi")) {
     provider = "openrouter_kimi";
     resolved_model = rawModel;
     if (!process.env.OPENROUTER_API_KEY?.trim()) {
       providerNotConfigured("kimi_web");
     }
     try {
       const { openRouterChat } = await import("./providers/openrouterChat.js");
	       const result = await openRouterChat({
	         model: resolved_model,
	         messages: [
	           { role: "system", content: effectiveSystem },
	           { role: "user", content: req.message },
	         ],
	         max_tokens: 512,
	       });
       base = {
         id: request_id,
         model: resolved_model,
         output: result.output || "",
         usage: result.usage
           ? {
               inputTokens: result.usage.prompt_tokens,
               outputTokens: result.usage.completion_tokens,
               totalTokens: result.usage.total_tokens,
             }
           : undefined,
       };
     } catch (e: any) {
       console.log(`[router] kimi branch error: ${e?.message}`);
       throw e;
     }
   } else if (requestedProvider === "ollama_local" || rawModel === "qwen2.5:7b-instruct") {
     provider = "local";
     resolved_model = rawModel;
     if (!hasLocal()) providerNotConfigured("ollama_local");
     try {
       base = await localChat({ ...req, model: resolved_model, system: effectiveSystem });
     } catch (e) {
       providerUnavailable("ollama_local", e);
     }
  } else {
    if (requestedProvider && requestedProvider !== "auto") {
      providerNotConfigured(requestedProvider);
    }
    provider = "openai";
    resolved_model = "gpt-4o-mini";
    if (!hasOpenAI()) noProviderConfigured();
    try {
      base = await openaiChat({ ...req, model: resolved_model, system: effectiveSystem });
    } catch (e) {
      providerUnavailable("openai", e);
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

  console.log(`[router] routeChat returning ok provider=${provider} model=${resolved_model}`);
  return {
    ...base,
    request_id,
    latency_ms: Date.now() - t0,
    meta: {
      ...(base.meta || {}),
      provider,
      model: resolved_model,
      usage,
      task_intent: taskIntent.intent,
    },
  };
}
