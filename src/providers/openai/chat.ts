import OpenAI from "openai";
import type { ChatRequest, ChatResponse } from "../../types/chat.ts";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function stripProviderPrefix(model?: string) {
  const m = model ?? "openai:gpt-4o-mini";
  return m.startsWith("openai:") ? m.slice("openai:".length) : m;
}

export async function openaiChat(req: ChatRequest): Promise<ChatResponse> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      id: "config-error",
      model: req.model ?? "openai:unknown",
      output: "OPENAI_API_KEY не задан. Добавь ключ в .env и перезапусти сервер.",
    };
  }

  const model = stripProviderPrefix(req.model);

  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (req.system) messages.push({ role: "system", content: req.system });
  messages.push({ role: "user", content: req.message ?? "" });

  const r = await client.chat.completions.create({ model, messages });
  const out = r.choices?.[0]?.message?.content ?? "";

  return {
    id: r.id ?? "openai",
    model: `openai:${model}`,
    output: out,
    usage: r.usage
      ? {
          inputTokens: r.usage.prompt_tokens,
          outputTokens: r.usage.completion_tokens,
          totalTokens: r.usage.total_tokens,
        }
      : undefined,
  };
}
