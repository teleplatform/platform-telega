import type { ExecutionResult } from "../../core/provider-execution.js";
import type { ChatMessage } from "../../core/provider-execution.js";

const QWEN_API_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";

export async function callQwen(
  model: string,
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<ExecutionResult> {
  const apiKey = process.env.QWEN_API_KEY?.trim() || process.env.DASHSCOPE_API_KEY?.trim();
  
  if (!apiKey) {
    return {
      ok: false,
      provider: "qwen_api" as any,
      model,
      error: { type: "auth", message: "QWEN_API_KEY / DASHSCOPE_API_KEY not configured" },
      fallbackUsed: false,
    };
  }

  const url = `${QWEN_API_BASE_URL}/chat/completions`;
  
  const formattedMessages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) {
    formattedMessages.push({ role: "system", content: systemPrompt });
  }
  for (const msg of messages) {
    // Map "assistant" to "assistant" for Qwen
    formattedMessages.push({ role: msg.role === "user" ? "user" : "assistant", content: msg.content });
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "qwen-max",
        messages: formattedMessages,
        temperature: 0.2,
        max_tokens: 512,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const isAuthError = response.status === 401 || response.status === 403;
      const isRateLimit = response.status === 429;
      
      return {
        ok: false,
        provider: "qwen_api" as any,
        model,
        error: {
          type: isAuthError ? "auth" : isRateLimit ? "rate_limit" : "invalid_request",
          message: `Qwen API error ${response.status}: ${errorText}`,
        },
        fallbackUsed: false,
      };
    }

    const data = await response.json() as any;
    const text = data.choices?.[0]?.message?.content || "";
    
    return {
      ok: true,
      provider: "qwen_api" as any,
      model: model || "qwen-max",
      text,
      fallbackUsed: false,
    };
  } catch (e: any) {
    const errorMessage = e?.message || "unknown error";
    const isNetwork = errorMessage.includes("ECONNREFUSED") || 
                      errorMessage.includes("ETIMEDOUT") || 
                      errorMessage.includes("network");
    
    return {
      ok: false,
      provider: "qwen_api" as any,
      model,
      error: {
        type: isNetwork ? "network" : "unknown",
        message: errorMessage,
      },
      fallbackUsed: false,
    };
  }
}