import type { ChatRequest, ChatResponse } from "../../types/chat.js";

const KIMI_FREE_LOCAL_BASE = process.env.KIMI_FREE_LOCAL_BASE_URL || "http://127.0.0.1:3271/v1";
const KIMI_FREE_LOCAL_MODEL = process.env.KIMI_FREE_LOCAL_MODEL || "kimi-k2";
const TIMEOUT_MS = 60_000;

export async function kimiFreeLocalChat(req: ChatRequest): Promise<ChatResponse> {
  const base = KIMI_FREE_LOCAL_BASE.replace(/\/+$/, "");
  const model = req.model || KIMI_FREE_LOCAL_MODEL;
  const url = `${base}/chat/completions`;

  const messages: Array<{ role: string; content: string }> = [];
  if (req.system) messages.push({ role: "system", content: req.system });
  messages.push({ role: "user", content: req.message });

  const body = JSON.stringify({
    model,
    messages,
    max_tokens: req.meta?.max_tokens ?? 2048,
    temperature: req.meta?.temperature ?? 0.7,
  });

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: ac.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`KIMI_FREE_LOCAL error ${res.status}: ${text.slice(0, 200)}`);
    }

    const json = await res.json() as any;
    const out = json.choices?.[0]?.message?.content ?? "";
    const reasoning = json.choices?.[0]?.message?.reasoning_content;

    return {
      id: json.id ?? "kimi-free-local",
      model: `kimi_free_local:${model}`,
      output: out + (reasoning ? `\n\n<details><summary>Reasoning</summary>${reasoning}</details>` : ""),
      meta: { provider: "kimi_free_local", model },
    };
  } catch (e: any) {
    if (e.name === "AbortError") {
      throw new Error("KIMI_FREE_LOCAL request timed out");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
