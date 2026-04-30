import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import http from "node:http";
import https from "node:https";

export interface LongformResult {
  success: boolean;
  text: string;
  filePath: string;
  model: string;
  latencyMs: number;
  wordCount: number;
  charCount: number;
  error?: string;
}

interface OllamaChatReq {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
    top_p?: number;
  };
}

const LONGFORM_TIMEOUT_MS = 8 * 60 * 1000;

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
      req.destroy(new Error(`Longform request timed out after ${timeoutMs}ms`));
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function buildLongformSystemPrompt(topic: string): string {
  return [
    "You are an expert long-form content writer.",
    "Write a comprehensive, detailed, well-structured article on the given topic.",
    "Use markdown formatting with headings, subheadings, lists, and paragraphs.",
    "Include an introduction, multiple body sections, and a conclusion.",
    "Write at least 2000 words. Be thorough and informative.",
    "Do not include any preamble about what you will write - start the article directly.",
    "Do not mention AI or language models.",
    `Topic: ${topic}`,
  ].join("\n\n");
}

function ensureOutputDir(): string {
  const dir = path.join(process.cwd(), "storage", "longform");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export async function generateLongform(
  topic: string,
  options?: {
    model?: string;
    ollamaUrl?: string;
    maxTokens?: number;
  },
): Promise<LongformResult> {
  const t0 = Date.now();
  const model = options?.model || process.env.LONGFORM_MODEL || "qwen2.5:7b-instruct";
  const baseUrl = (options?.ollamaUrl || process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
  const maxTokens = options?.maxTokens || 16384;

  const url = `${baseUrl}/api/chat`;
  const body: OllamaChatReq = {
    model,
    messages: [
      { role: "system", content: buildLongformSystemPrompt(topic) },
      { role: "user", content: `Write a comprehensive article about: ${topic}` },
    ],
    stream: false,
    options: {
      temperature: 0.7,
      num_predict: maxTokens,
      top_p: 0.9,
    },
  };

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  try {
    const response = await postJson(url, headers, JSON.stringify(body), LONGFORM_TIMEOUT_MS);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      return {
        success: false,
        text: "",
        filePath: "",
        model,
        latencyMs: Date.now() - t0,
        wordCount: 0,
        charCount: 0,
        error: `Ollama error: ${response.statusCode} - ${response.body.slice(0, 500)}`,
      };
    }

    const json = JSON.parse(response.body);
    let text = json.message?.content ?? json.output ?? "";

    if (!text) {
      return {
        success: false,
        text: "",
        filePath: "",
        model,
        latencyMs: Date.now() - t0,
        wordCount: 0,
        charCount: 0,
        error: "Empty response from Ollama",
      };
    }

    const wordCount = countWords(text);
    const charCount = text.length;

    const outputDir = ensureOutputDir();
    const fileName = `longform_${Date.now()}_${randomUUID().slice(0, 8)}.md`;
    const filePath = path.join(outputDir, fileName);

    const frontmatter = [
      "---",
      `title: "${topic.replace(/"/g, '\\"')}"`,
      `generated: ${new Date().toISOString()}`,
      `model: ${model}`,
      `word_count: ${wordCount}`,
      `char_count: ${charCount}`,
      "---",
      "",
    ].join("\n");

    fs.writeFileSync(filePath, frontmatter + text, "utf-8");

    console.log(`[longform] Generated: ${filePath} (${wordCount} words, ${charCount} chars, ${Date.now() - t0}ms)`);

    return {
      success: true,
      text,
      filePath,
      model,
      latencyMs: Date.now() - t0,
      wordCount,
      charCount,
    };
  } catch (e: any) {
    return {
      success: false,
      text: "",
      filePath: "",
      model,
      latencyMs: Date.now() - t0,
      wordCount: 0,
      charCount: 0,
      error: e?.message || "Unknown error",
    };
  }
}
