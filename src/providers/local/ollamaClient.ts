export interface OllamaChatParams {
  model: string;
  prompt: string;
  system?: string;
  temperature?: number;
}

export interface OllamaChatResult {
  text: string;
  raw: unknown;
}

export async function callOllamaChat(params: OllamaChatParams): Promise<OllamaChatResult> {
  const res = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: params.model,
      stream: false,
      options: {
        temperature: params.temperature ?? 0.4,
      },
      messages: [
        ...(params.system ? [{ role: "system", content: params.system }] : []),
        { role: "user", content: params.prompt },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Ollama error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return {
    text: data.message?.content ?? "",
    raw: data,
  };
}

export async function checkOllamaHealth(): Promise<{ ok: boolean; models: string[] }> {
  try {
    const res = await fetch("http://localhost:11434/api/tags", {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { ok: false, models: [] };
    const data = await res.json();
    const models: string[] = (data.models || []).map((m: any) => m.name);
    return { ok: true, models };
  } catch {
    return { ok: false, models: [] };
  }
}
