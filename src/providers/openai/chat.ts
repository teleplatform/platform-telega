import OpenAI from "openai";
import type { ChatRequest, ChatResponse } from "../../types/chat.js";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = (process.env.OPENAI_API_KEY || "").trim();
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }
    client = new OpenAI({ 
      apiKey,
      maxRetries: 2,
    });
  }
  return client;
}

function stripProviderPrefix(model?: string) {
  const m = model ?? "openai:gpt-4o-mini";
  return m.startsWith("openai:") ? m.slice("openai:".length) : m;
}

export async function openaiChat(req: ChatRequest): Promise<ChatResponse> {
  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    return {
      id: "config-error",
      model: req.model ?? "openai:unknown",
      output: "OPENAI_API_KEY не задан. Добавь ключ в .env и перезапусти сервер.",
    };
  }

  const model = stripProviderPrefix(req.model);

  const systemContent = req.system ?? "";
  const userContent = req.message ?? "";

  const messages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: String(systemContent) },
    { role: "user", content: String(userContent) },
  ];

  console.log("[provider:openai:messages]", {
    messages_count: messages.length,
    first_role: messages[0]?.role ?? "(none)",
    first_content_preview: messages[0]?.content ? messages[0].content.slice(0, 300) : "(none)",
    last_user_content_preview: messages.find(m => m.role === "user")?.content.slice(0, 200) ?? "(none)",
  });

  try {
    console.log("[openai-chat] process.env.OPENAI_API_KEY first 20 chars:", (process.env.OPENAI_API_KEY || "").slice(0, 20));
    console.log("[openai-chat] Calling API with:", { model, messageLen: userContent.length, apiKeyLen: apiKey.length, hasTools: !!req.tools, toolChoice: req.tool_choice });

    const apiParams: Record<string, unknown> = { model, messages };
    if (req.tools && Array.isArray(req.tools) && req.tools.length > 0) {
      apiParams.tools = req.tools;
      apiParams.tool_choice = req.tool_choice ?? "auto";
    }

    const r = await getClient().chat.completions.create(apiParams as any);

    const message = r.choices?.[0]?.message;
    const out = message?.content ?? "";
    const toolCalls = message?.tool_calls;

    const usage = r.usage
      ? {
          tokens_in: r.usage.prompt_tokens,
          tokens_out: r.usage.completion_tokens,
        }
      : undefined;

    const response: ChatResponse = {
      id: r.id ?? "openai",
      model: `openai:${model}`,
      output: out,
      meta: usage ? { provider: "openai", model: `openai:${model}`, usage } : undefined,
      usage: r.usage
        ? {
            inputTokens: r.usage.prompt_tokens,
            outputTokens: r.usage.completion_tokens,
            totalTokens: r.usage.total_tokens,
          }
        : undefined,
    };

    if (toolCalls && toolCalls.length > 0) {
      (response as any).tool_calls = toolCalls;
    }

    return response;
  } catch (e: any) {
    console.error("[OPENAI_CHAT] error:", e?.message);
    throw e;
  }
}
