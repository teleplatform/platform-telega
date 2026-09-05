import type { ExecutionResult } from "../../core/provider-execution.js";
import type { ChatMessage } from "../../core/provider-execution.js";
import type { ChatRequest, ChatResponse } from "../../types/chat.js";

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
      const isAuthError = response.status === 401 || response.status === 403;
      const isRateLimit = response.status === 429;
      
      return {
        ok: false,
        provider: "qwen_api" as any,
        model,
        error: {
          type: isAuthError ? "auth" : isRateLimit ? "rate_limit" : "invalid_request",
          message: `Qwen API error ${response.status}`,
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

export async function qwenChat(req: ChatRequest): Promise<ChatResponse> {
  const modelParam = req.model || "qwen-max";
  const messages: ChatMessage[] = [];
  if (req.system) {
    messages.push({ role: "system", content: req.system });
  }
  messages.push({ role: "user", content: req.message });

  console.log("[provider:qwen:messages]", {
    messages_count: messages.length,
    first_role: messages[0]?.role ?? "(none)",
    last_user_content_preview: messages.find(m => m.role === "user")?.content.slice(0, 200) ?? "(none)",
  });

  const result = await callQwen(modelParam, messages, req.system);

  if (!result.ok) {
    const errType = result.error?.type || "unknown";
    const errMsg = result.error?.message || "Qwen API call failed";
    console.error("[provider:qwen:failed]", { model: modelParam, error_type: errType, error: errMsg });
    throw new Error(`qwen_${errType === "auth" ? "auth_failed" : errType === "rate_limit" ? "rate_limited" : "model_unavailable"}: ${errMsg}`);
  }

  console.log("[provider:qwen:success]", { model: modelParam, text_len: result.text?.length ?? 0 });

  return {
    id: req.request_id || `qwen_${Date.now()}`,
    model: modelParam,
    output: result.text ?? "",
  };
}