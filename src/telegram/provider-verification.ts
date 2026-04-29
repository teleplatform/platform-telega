import fs from "fs/promises";
import path from "path";
import https from "https";
import http from "http";

const DATA_DIR = path.join(process.cwd(), "data");
const VALIDATION_DIR = path.join(DATA_DIR, "validation");
const DOCS_DIR = path.join(process.cwd(), "docs", "validation");
const DELIVERY_DIR = path.join(DATA_DIR, "telegram");

export interface ProviderVerification {
  provider: string;
  test_id: string;
  status: "PASS" | "WARN" | "FAIL" | "RATE_LIMIT" | "DEGRADED";
  test_prompt: string;
  response_length: number;
  latency_ms: number;
  is_partial: boolean;
  fallback_used: boolean;
  delivery_logged: boolean;
  error?: string;
  timestamp: number;
}

const TEST_PROMPT = "Say hi and confirm you received this message";

const PROVIDERS = [
  "chatgpt_web",
  "qwen_web",
  "deepseek_web",
  "grok_web",
  "perplexity_web",
  "claude_web",
  "gemini_web",
  "poe_web",
  "kimi_web",
];

async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

function httpPost(
  url: string,
  body: object
): Promise<{ ok: boolean; status?: number; data?: any; latency: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const isHttps = url.startsWith("https");
    const client = isHttps ? https : http;

    const req = client.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          const latency = Date.now() - start;
          try {
            const json = JSON.parse(data);
            resolve({ ok: res.statusCode === 200, status: res.statusCode, data: json, latency });
          } catch {
            resolve({ ok: false, status: res.statusCode, latency });
          }
        });
      }
    );

    req.on("error", (e) => {
      const latency = Date.now() - start;
      resolve({ ok: false, latency });
    });

    req.setTimeout(30000, () => {
      req.destroy();
      const latency = Date.now() - start;
      resolve({ ok: false, latency });
    });

    req.write(JSON.stringify(body));
    req.end();
  });
}

function detectPartial(text: string): boolean {
  if (!text || text.length < 5) return true;
  const patterns = [
    /continue$/i,
    /continu(ing|e)$/i,
    /\.\.\.$/,
    /and then$/i,
    /so$/i,
    /but$/i,
  ];
  return patterns.some((p) => p.test(text.trim()));
}

async function logDelivery(provider: string, response: string): Promise<void> {
  const deliveryFile = path.join(DELIVERY_DIR, "delivery.jsonl");
  await ensureDir(DELIVERY_DIR);
  const line = JSON.stringify({
    provider,
    response_length: response.length,
    timestamp: Date.now(),
  });
  await fs.appendFile(deliveryFile, line + "\n");
}

export async function verifyProvider(name: string): Promise<ProviderVerification> {
  const testId = `pv-${name}-${Date.now()}`;
  const t0 = Date.now();

  let status: ProviderVerification["status"] = "FAIL";
  let responseLength = 0;
  let isPartial = false;
  let fallbackUsed = false;
  let deliveryLogged = false;
  let error: string | undefined;
  let responseText = "";

  try {
    const result = await httpPost("http://127.0.0.1:8787/api/bridge", {
      message: TEST_PROMPT,
      model: name,
    });

    if (!result.ok) {
      if (result.status === 429) {
        status = "RATE_LIMIT";
        error = `HTTP ${result.status}`;
      } else {
        status = "FAIL";
        error = `HTTP ${result.status}`;
      }
    } else if (!result.data?.text) {
      status = "FAIL";
      error = "no response text";
    } else {
      responseText = result.data.text;
      responseLength = responseText.length;
      isPartial = detectPartial(responseText);
      fallbackUsed = result.data.meta?.fallback_used === true;

      await logDelivery(name, responseText);
      deliveryLogged = true;

      if (isPartial) {
        status = "WARN";
      } else if (fallbackUsed) {
        status = "DEGRADED";
      } else {
        status = "PASS";
      }
    }

    if (result.latency) {
      await logDelivery(name, responseText);
    }
  } catch (e: any) {
    error = e?.message || "unknown error";
    status = "FAIL";
  }

  const latency = Date.now() - t0;

  return {
    provider: name,
    test_id: testId,
    status,
    test_prompt: TEST_PROMPT,
    response_length: responseLength,
    latency_ms: latency,
    is_partial: isPartial,
    fallback_used: fallbackUsed,
    delivery_logged: deliveryLogged,
    error,
    timestamp: Date.now(),
  };
}

export async function verifyAllProviders(): Promise<ProviderVerification[]> {
  const results: ProviderVerification[] = [];

  await ensureDir(VALIDATION_DIR);
  await ensureDir(DOCS_DIR);

  for (const provider of PROVIDERS) {
    const result = await verifyProvider(provider);
    results.push(result);

    const line = JSON.stringify(result);
    const jsonlPath = path.join(VALIDATION_DIR, "provider-verification.jsonl");
    await fs.appendFile(jsonlPath, line + "\n");
  }

  return results;
}

export async function getProviderVerificationReport(): Promise<{
  summary: { total: number; pass: number; warn: number; fail: number; rate_limit: number; degraded: number };
  results: ProviderVerification[];
}> {
  const jsonlPath = path.join(VALIDATION_DIR, "provider-verification.jsonl");

  try {
    const content = await fs.readFile(jsonlPath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    const results = lines.map((l) => JSON.parse(l)).filter(Boolean);

    return {
      summary: {
        total: results.length,
        pass: results.filter((r: any) => r.status === "PASS").length,
        warn: results.filter((r: any) => r.status === "WARN").length,
        fail: results.filter((r: any) => r.status === "FAIL").length,
        rate_limit: results.filter((r: any) => r.status === "RATE_LIMIT").length,
        degraded: results.filter((r: any) => r.status === "DEGRADED").length,
      },
      results: results.reverse().slice(0, 9),
    };
  } catch {
    return {
      summary: { total: 0, pass: 0, warn: 0, fail: 0, rate_limit: 0, degraded: 0 },
      results: [],
    };
  }
}

export async function saveProviderVerificationReport(
  results: ProviderVerification[]
): Promise<void> {
  await ensureDir(DOCS_DIR);

  const pass = results.filter((r) => r.status === "PASS").length;
  const warn = results.filter((r) => r.status === "WARN").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const rateLimit = results.filter((r) => r.status === "RATE_LIMIT").length;
  const degraded = results.filter((r) => r.status === "DEGRADED").length;

  const md = `# Provider Verification Report

**Date:** ${new Date().toISOString()}
**Version:** v1

## Summary

| Status | Count |
|--------|-------|
| PASS | ${pass} |
| WARN | ${warn} |
| FAIL | ${fail} |
| RATE_LIMIT | ${rateLimit} |
| DEGRADED | ${degraded} |

## Results

| Provider | Status | Latency | Length | Partial | Fallback |
|----------|--------|--------|--------|---------|
${results.map((r) => `| ${r.provider} | ${r.status} | ${r.latency_ms}ms | ${r.response_length} | ${r.is_partial} | ${r.fallback_used} |`).join("\n")}

## Rules

- PASS: Response received, non-empty, not partial, no fallback
- WARN: Response partial (truncated)
- DEGRADED: Fallback was used
- RATE_LIMIT: HTTP 429
- FAIL: No response or error

---
Generated at ${new Date().toISOString()}
`;

  const mdPath = path.join(DOCS_DIR, "PROVIDER_VERIFICATION_latest.md");
  await fs.writeFile(mdPath, md);
}