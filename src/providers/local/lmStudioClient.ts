export interface LMStudioChatParams {
  model: string;
  prompt: string;
  system?: string;
  temperature?: number;
}

export interface LMStudioChatResult {
  text: string;
  raw: unknown;
}

export async function callLMStudioChat(params: LMStudioChatParams): Promise<LMStudioChatResult> {
  const res = await fetch("http://localhost:1234/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: params.model,
      messages: [
        ...(params.system ? [{ role: "system", content: params.system }] : []),
        { role: "user", content: params.prompt },
      ],
      temperature: params.temperature ?? 0.4,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`LM Studio error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    raw: data,
  };
}

export async function checkLMStudioHealth(): Promise<{ ok: boolean; models: string[] }> {
  try {
    const res = await fetch("http://localhost:1234/v1/models", {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { ok: false, models: [] };
    const data = await res.json();
    const models: string[] = (data.data || []).map((m: any) => m.id);
    return { ok: true, models };
  } catch {
    return { ok: false, models: [] };
  }
}
