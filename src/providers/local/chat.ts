import http from "node:http";
import https from "node:https";
import type { ChatRequest, ChatResponse } from "../../types/chat.js";
import { getFullSystemPrompt } from "../../runtime/identity/index.js";

type OpenAIChatReq = {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
};

type OpenAIChatResp = {
  message?: { content?: string };
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

const LOCAL_OPENAI_TIMEOUT_MS = 10 * 60 * 1000;

function postJson(
  urlString: string,
  headers: Record<string, string>,
  body: string,
  timeoutMs: number,
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const client = url.protocol === "https:" ? https : http;
    const req = client.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        headers: {
          ...headers,
          "content-length": Buffer.byteLength(body).toString(),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`LOCAL_OPENAI request timed out after ${timeoutMs}ms`));
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

export async function chat(req: ChatRequest): Promise<ChatResponse> {
  let base = (process.env.LOCAL_OPENAI_BASE_URL || "").trim().replace(/\/+$/, "");
  if (base.includes("//localhost:")) {
    base = base.replace("//localhost:", "//127.0.0.1:");
  }
  const model = (process.env.LOCAL_OPENAI_MODEL || process.env.LOCAL_OPENAI_MODEL_DEFAULT || req.model || "local-model").trim();

  if (!base) {
    return {
      id: "local-demo",
      model: "local:local-demo",
      output: "Привет! Я здесь. Сейчас я работаю через локальный режим. Напиши /settings чтобы включить Bridge и выбрать провайдера.",
      meta: { provider: "local", model: "local-demo" },
    };
  }

  const url = `${base}/api/chat`;
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  const identityPrompt = getFullSystemPrompt();
  messages.push({ role: "system", content: identityPrompt });
  if (req.system) {
    messages.push({ role: "system", content: req.system });
  }
  messages.push({ role: "user", content: req.message });

  const meta = req.meta ?? {};
  const body: OpenAIChatReq = {
    model,
    messages,
    temperature: typeof meta.temperature === "number" ? meta.temperature : 0.2,
    max_tokens: typeof meta.max_tokens === "number" ? meta.max_tokens : 192,
    top_p: typeof meta.top_p === "number" ? meta.top_p : 0.9,
    stream: false,
  };
  const timeoutMs = typeof meta.timeout_ms === "number" ? meta.timeout_ms : LOCAL_OPENAI_TIMEOUT_MS;

  const key = (process.env.LOCAL_OPENAI_API_KEY || "").trim();
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (key) headers.authorization = `Bearer ${key}`;

  const response = await postJson(url, headers, JSON.stringify(body), timeoutMs);

  console.log("[LOCAL_CHAT] response status:", response.statusCode, "body:", response.body.slice(0, 200));

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`LOCAL_OPENAI upstream error: ${response.statusCode}`);
  }

  const json = JSON.parse(response.body) as OpenAIChatResp;
  let out = json.message?.content ?? json.choices?.[0]?.message?.content ?? "";

  const MODEL_OBFUSCATION_WORDS = [
    "qwen", "openai", "deepseek", "llama", "gpt-", "ollama",
    "alibaba", "anthropic", "claude", "gemma", "mistral"
  ];
  for (const w of MODEL_OBFUSCATION_WORDS) {
    if (out.toLowerCase().includes(w)) {
      console.log(`[OBFUSCATE] Found "${w}", replacing...`);
      out = out.replace(new RegExp(w, "gi"), "Москвич 412");
    }
  }

  const usage = json.usage
    ? {
        tokens_in: json.usage.prompt_tokens,
        tokens_out: json.usage.completion_tokens,
      }
    : undefined;

  return {
    id: "local",
    model: `local:${model}`,
    output: out,
    meta: {
      provider: "local",
      model,
      usage,
    },
  };
}
