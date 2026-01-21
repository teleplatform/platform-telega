import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

import { buildServer } from "../src/server/p2_storage.ts";

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

type SmokeErrCode =
  | "E_LOCAL_PROVIDER_DOWN"
  | "E_HTTP_ERROR"
  | "E_MODELS_ENDPOINT_INVALID"
  | "E_MODEL_NOT_FOUND"
  | "E_TRACES_INVALID"
  | "E_EXPECTATION_FAILED";

function fail(code: SmokeErrCode, details: Record<string, unknown>) {
  const msg = `${code}: ${JSON.stringify(details)}`;
  throw new Error(msg);
}

async function fetchJson(
  url: string,
  init?: RequestInit & { timeoutMs?: number }
) {
  const timeoutMs = init?.timeoutMs ?? 3500;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const r = await fetch(url, {
      ...init,
      signal: ctrl.signal,
    });
    const text = await r.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      // ignore
    }
    return { status: r.status, ok: r.ok, json, text: text.slice(0, 2000) };
  } catch (e: any) {
    const name = String(e?.name ?? "");
    const code = String(e?.code ?? "");
    const cause = String(e?.cause?.code ?? e?.cause ?? "");

    fail("E_LOCAL_PROVIDER_DOWN", {
      url,
      timeoutMs,
      name: name || undefined,
      code: code || undefined,
      cause: cause || undefined,
    });
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  // Canon env: local provider only
  process.env.TELEGA_MODE = "creator";
  delete process.env.OPENAI_API_KEY;

  process.env.LOCAL_OPENAI_BASE_URL =
    process.env.LOCAL_OPENAI_BASE_URL ?? "http://127.0.0.1:11434/v1";
  process.env.LOCAL_OPENAI_MODEL =
    process.env.LOCAL_OPENAI_MODEL ?? "deepseek-r1:1.5b";

  const tmpDir = path.join(
    process.cwd(),
    ".data",
    `_smoke_local_${Date.now()}_${Math.random().toString(16).slice(2)}`
  );
  fs.mkdirSync(tmpDir, { recursive: true });
  process.env.TELEGPT_DATA_DIR = tmpDir;

  const baseUrl = process.env.LOCAL_OPENAI_BASE_URL.replace(/\/+$/, "");

  // Proof that provider endpoint is live
  const models = await fetchJson(`${baseUrl}/models`, { timeoutMs: 3500 });
  if (!models.ok) {
    fail("E_HTTP_ERROR", {
      url: `${baseUrl}/models`,
      status: models.status,
      body: models.text,
    });
  }

  // OpenAI-compatible /v1/models typically returns {object:'list', data:[{id:...}]}
  const modelIds = Array.isArray(models.json?.data)
    ? models.json.data.map((m: any) => String(m?.id ?? "")).filter(Boolean)
    : null;
  if (!modelIds) {
    fail("E_MODELS_ENDPOINT_INVALID", {
      url: `${baseUrl}/models`,
      body: models.text,
    });
  }

  const expectedModel = String(process.env.LOCAL_OPENAI_MODEL);
  const modelFound = modelIds.includes(expectedModel);
  if (!modelFound) {
    fail("E_MODEL_NOT_FOUND", {
      expectedModel,
      available: modelIds.slice(0, 20),
    });
  }

  const app = await buildServer();
  const address = await app.listen({ host: "127.0.0.1", port: 0 });

  // Fastify returns e.g. http://127.0.0.1:12345
  const serverBase = String(address).replace(/\/+$/, "");

  try {
    const ask = await fetchJson(`${serverBase}/v1/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "hello local" }),
    });
    assert.equal(ask.ok, true, `ask failed: ${ask.status} ${ask.text}`);

    // Give storage a beat (mostly for sanity)
    await sleep(10);

    const traces = await fetchJson(`${serverBase}/v1/traces?limit=1`);
    assert.equal(traces.ok, true, `traces failed: ${traces.status} ${traces.text}`);

    const item = traces.json?.items?.[0];
    if (!item || typeof item !== "object") {
      fail("E_TRACES_INVALID", {
        body: traces.text,
      });
    }

    if (item.provider !== "local") {
      fail("E_EXPECTATION_FAILED", {
        expected: { provider: "local", model: expectedModel },
        got: { provider: item.provider, model: item.model },
      });
    }

    // Hard requirement: no silent fallback. If local provider is up and model exists,
    // we must see that model in traces.
    if (item.model !== expectedModel) {
      fail("E_EXPECTATION_FAILED", {
        expected: { provider: "local", model: expectedModel },
        got: { provider: item.provider, model: item.model },
      });
    }
  } finally {
    await app.close();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
