type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function has(v?: string) {
  return typeof v === "string" && v.trim().length > 0;
}

export function hasDashScopeKey() {
  return has(process.env.DASHSCOPE_API_KEY);
}

function must(v: string | undefined, name: string) {
  if (!v || !v.trim()) throw new Error(`${name}_missing`);
  return v.trim();
}

export async function dashScopeQwenChat(opts: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}): Promise<{
  output: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  raw: any;
}> {
  const apiKey = must(process.env.DASHSCOPE_API_KEY, "DASHSCOPE_API_KEY");

  const res = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.6,
      max_tokens: opts.max_tokens,
    }),
  });

  const rawText = await res.text();
  if (!res.ok) {
    throw new Error(`dashscope_${res.status}: ${rawText}`);
  }

  const data = JSON.parse(rawText);
  const output = data?.choices?.[0]?.message?.content ?? "";
  const usage = data?.usage
    ? {
        prompt_tokens: data.usage.prompt_tokens,
        completion_tokens: data.usage.completion_tokens,
        total_tokens: data.usage.total_tokens,
      }
    : undefined;

  return { output, usage, raw: data };
}
