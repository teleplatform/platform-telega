import type { ExecutionResult } from "../../core/provider-execution.js";
import type { ChatMessage } from "../../core/provider-execution.js";

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
      const errorText = await response.text();
      const isAuthError = response.status === 401 || response.status === 403;
      const isRateLimit = response.status === 429;

      return {
        ok: false,
        provider: "deepseek_api" as any,
        model: effectiveModel,
        error: {
          type: isAuthError ? "auth" : isRateLimit ? "rate_limit" : "invalid_request",
          message: `DeepSeek API error ${response.status}: ${errorText}`,
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