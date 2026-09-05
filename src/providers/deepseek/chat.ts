import type { ExecutionResult } from "../../core/provider-execution.js";
import type { ChatMessage } from "../../core/provider-execution.js";
import type { ChatRequest, ChatResponse } from "../../types/chat.js";

const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL?.replace(/\/$/, "") || "https://api.deepseek.com";

function getDeepSeekModel(modelParam?: string, taskType?: string): string {
  // If model is explicitly specified, use it
  if (modelParam && modelParam !== "deepseek-chat") {
    return modelParam;
  }

  const defaultModel = process.env.DEEPSEEK_MODEL_DEFAULT || "deepseek-v4-flash";
  const reasoningModel = process.env.DEEPSEEK_MODEL_REASONING || "deepseek-r1";

  if (taskType === "reasoning") {
    return reasoningModel;
  }
  // For "chat" or unspecified, use default (fast) model
  return defaultModel;
}

export async function callDeepSeek(
  modelParam: string,
  messages: ChatMessage[],
  systemPrompt?: string,
  taskType?: string
): Promise<ExecutionResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();

  if (!apiKey) {
    return {
      ok: false,
      provider: "deepseek_api" as any,
      model: modelParam,
      error: { type: "auth", message: "DEEPSEEK_API_KEY not configured" },
      fallbackUsed: false,
    };
  }

  // Select model based on task type and env configuration
  const effectiveModel = getDeepSeekModel(modelParam, taskType);
  console.log(`[router] deepseek selected model: ${effectiveModel} (task=${taskType || "chat"})`);

  const url = `${DEEPSEEK_BASE_URL}/v1/chat/completions`;

  const formattedMessages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) {
    formattedMessages.push({ role: "system", content: systemPrompt });
  }
  for (const msg of messages) {
    formattedMessages.push({ role: msg.role, content: msg.content });
  }

  console.log(`[router] before callDeepSeek model=${effectiveModel} messages=${formattedMessages.length}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: effectiveModel,
        messages: formattedMessages,
        temperature: 0.2,
        max_tokens: 512,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

if (!response.ok) {
      const isAuthError = response.status === 401 || response.status === 403;
      const isRateLimit = response.status === 429;

      return {
        ok: false,
        provider: "deepseek_api" as any,
        model: effectiveModel,
        error: {
          type: isAuthError ? "auth" : isRateLimit ? "rate_limit" : "invalid_request",
          message: `DeepSeek API error ${response.status}`,
        },
        fallbackUsed: false,
      };
    }

    const data = await response.json() as any;
    const text = data.choices?.[0]?.message?.content || "";

    console.log(`[router] after callDeepSeek model=${effectiveModel} text_len=${text.length}`);
    return {
      ok: true,
      provider: "deepseek_api" as any,
      model: effectiveModel,
      text,
      fallbackUsed: false,
    };
  } catch (e: any) {
    const errorMessage = e?.message || "unknown error";
    const isNetwork = errorMessage.includes("ECONNREFUSED") ||
                      errorMessage.includes("ETIMEDOUT") ||
                      errorMessage.includes("network") ||
                      errorMessage.includes("abort");

    console.log(`[router] callDeepSeek failed error=${errorMessage}`);

    return {
      ok: false,
      provider: "deepseek_api" as any,
      model: effectiveModel,
      error: {
        type: isNetwork ? "network" : "unknown",
        message: errorMessage,
      },
      fallbackUsed: false,
    };
  }
}

export async function deepseekChat(req: ChatRequest): Promise<ChatResponse> {
  const modelParam = req.model || "deepseek-chat";
  const messages: ChatMessage[] = [];
  if (req.system) {
    messages.push({ role: "system", content: req.system });
  }
  messages.push({ role: "user", content: req.message });

  console.log("[provider:deepseek:messages]", {
    messages_count: messages.length,
    first_role: messages[0]?.role ?? "(none)",
    first_content_preview: messages[0]?.content ? messages[0].content.slice(0, 300) : "(none)",
    last_user_content_preview: messages.find(m => m.role === "user")?.content.slice(0, 200) ?? "(none)",
  });

  const result = await callDeepSeek(
    modelParam,
    messages,
    req.system,
    (req as any).task?.type,
  );

  if (!result.ok) {
    throw new Error(result.error?.message || "DeepSeek API call failed");
  }

  console.log("[router:routeChat:deepseek:result]", {
    model: modelParam,
    text_len: result.text?.length ?? 0,
  });

  return {
    id: req.request_id || `deepseek_${Date.now()}`,
    model: modelParam,
    output: result.text ?? "",
  };
}