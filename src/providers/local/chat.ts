import type { ChatRequest, ChatResponse } from "../../types/chat.ts";

type OpenAIChatReq = {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
};

type OpenAIChatResp = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

export async function chat(req: ChatRequest): Promise<ChatResponse> {
  const base = (process.env.LOCAL_OPENAI_BASE_URL || "").trim().replace(/\/+$/, "");
  const model = (process.env.LOCAL_OPENAI_MODEL || req.model || "local-model").trim();

  if (!base) {
    return {
      output: `local-demo: ${req.message}`,
      meta: { provider: "local", model: "local-demo" },
    };
  }

  const url = `${base}/chat/completions`;
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  if (req.system) {
    messages.push({ role: "system", content: req.system });
  }
  messages.push({ role: "user", content: req.message });

  const body: OpenAIChatReq = {
    model,
    messages,
    temperature: 0.2,
  };

  const key = (process.env.LOCAL_OPENAI_API_KEY || "").trim();
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (key) headers["authorization"] = `Bearer ${key}`;

  const r = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    throw new Error(`LOCAL_OPENAI upstream error: ${r.status}`);
  }

  const json = (await r.json()) as OpenAIChatResp;
  const out = json.choices?.[0]?.message?.content ?? "";

  const usage = json.usage
    ? {
        tokens_in: json.usage.prompt_tokens,
        tokens_out: json.usage.completion_tokens,
      }
    : undefined;

  return {
    output: out,
    meta: {
      provider: "local",
      model,
      usage,
    },
  };
}
