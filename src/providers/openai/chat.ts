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

  console.log("[OPENAI_CHAT] request:", { model, systemLen: systemContent.length, userLen: userContent.length });

  try {
    console.log("[openai-chat] process.env.OPENAI_API_KEY first 20 chars:", (process.env.OPENAI_API_KEY || "").slice(0, 20));
    console.log("[openai-chat] Calling API with:", { model, messageLen: userContent.length, apiKeyLen: apiKey.length });
    const r = await getClient().chat.completions.create({
      model,
      messages,
    });

    const out = r.choices?.[0]?.message?.content ?? "";
    const usage = r.usage
      ? {
          tokens_in: r.usage.prompt_tokens,
          tokens_out: r.usage.completion_tokens,
        }
      : undefined;

    return {
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
  } catch (e: any) {
    console.error("[OPENAI_CHAT] error:", e?.message);
    throw e;
  }
}
