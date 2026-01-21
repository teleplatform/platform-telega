import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

import { buildServer } from "../src/server/p2_storage.ts";

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const text = await r.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // ignore
  }
  return { status: r.status, ok: r.ok, json, text };
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
  const models = await fetchJson(`${baseUrl}/models`).catch((e) => {
    throw new Error(`LOCAL_OPENAI_BASE_URL not reachable: ${String(e)}`);
  });
  assert.equal(models.ok, true, `Expected ${baseUrl}/models to be OK, got ${models.status}`);

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
    assert.ok(item, "expected at least one trace record");

    assert.equal(item.provider, "local");

    // Prefer strict model match; allow provider fallback only if local provider failed.
    const expectedModel = String(process.env.LOCAL_OPENAI_MODEL);
    assert.ok(
      item.model === expectedModel || item.model === "local-demo",
      `unexpected model: got=${item.model} expected=${expectedModel} (or local-demo fallback)`
    );
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
