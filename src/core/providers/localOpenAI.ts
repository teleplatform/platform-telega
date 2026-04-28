export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type LocalChatResult = {
  text: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  raw?: any;
};

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function localChatCompletion(args: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}): Promise<LocalChatResult> {
  const baseUrl = mustEnv("LOCAL_OPENAI_BASE_URL");
  const apiKey = process.env.LOCAL_OPENAI_API_KEY || "";

  const url = `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: args.model,
      messages: args.messages,
      temperature: args.temperature ?? 0.2,
      max_tokens: args.max_tokens ?? 512,
    }),
  });

  const json = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    const errMsg = json?.error?.message || `Local provider error: HTTP ${resp.status}`;
    throw new Error(errMsg);
  }

  const text =
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.text ??
    "";

  return {
    text,
    usage: json?.usage,
    raw: json,
  };
}

export async function localListModels(): Promise<string[]> {
  const baseUrl = mustEnv("LOCAL_OPENAI_BASE_URL");
  const apiKey = process.env.LOCAL_OPENAI_API_KEY || "";
  const url = `${baseUrl.replace(/\/$/, "")}/v1/models`;

  const resp = await fetch(url, {
    headers: {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) return [];

  const data = Array.isArray(json?.data) ? json.data : [];
  return data.map((m: any) => m?.id).filter(Boolean);
}
