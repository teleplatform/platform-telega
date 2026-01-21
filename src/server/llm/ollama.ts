// src/server/llm/ollama.ts
type OllamaGenerateReq = {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: Record<string, any>;
};

type OllamaGenerateRes = {
  response?: string;
  done?: boolean;
  error?: string;
};

export async function ollamaGenerate(opts: {
  model: string;
  prompt: string;
  timeoutMs?: number;
  temperature?: number;
}): Promise<string> {
  const { model, prompt, timeoutMs = 60000, temperature = 0 } = opts;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature,
        },
      } satisfies OllamaGenerateReq),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`ollama_http_${res.status}: ${txt || res.statusText}`);
    }

    const data = (await res.json()) as OllamaGenerateRes;
    const out = String(data?.response ?? "").trim();
    if (!out) throw new Error("ollama_empty_response");
    return out;
  } finally {
    clearTimeout(t);
  }
}
