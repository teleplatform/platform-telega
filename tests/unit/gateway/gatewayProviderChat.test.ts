// PD-W3/B4-B — Authenticated local chat Dispatch slice (gateway level).
// Run with: npx tsx tests/unit/gateway/gatewayProviderChat.test.ts
//
// Proof targets (per B4-B gate):
// 1. EXACT local:local-chat → Dispatch; routeChat = 0 for the migrated slice.
// 2. Other models stay on the legacy routeChat seam (their own completion record).
// 3. Demo slice behavior unchanged.
// 4. Auth gates 401 before dispatch; model allowlist 403; stream:true 400.
// 5. ProviderRouterV2 decision used and preserved; output equals canonical
//    localChat leaf; offline deterministic.
// 6. Single canonical evidence lifecycle, no duplicate gateway lifecycle.
// 7. Response compatibility preserved.
// 8. Controlled localhost OpenAI-compatible fixture proves HTTP transport.

import assert from "node:assert/strict";
import Fastify from "fastify";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { registerChatCompletionsRoute } from "../../../src/gateway/routes/chat-completions.js";
import { createApiKey, type TeleGptApiKey } from "../../../src/api-keys/store.js";
import {
  initExecutionEvidenceStore,
  getEvidenceByType,
  getEvidenceByTrace,
  readEvidenceRecords,
} from "../../../src/runtime/evidence/execution-evidence-store.js";
import { chat } from "../../../src/providers/local/chat.js";
import { isProviderChatModel, isDemoModel } from "../../../src/gateway/dispatch-adapter.js";

let passed = 0;
let failed = 0;
let counter = 0;

const tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];

function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn });
}

async function runTests() {
  for (const t of tests) {
    try {
      await t.fn();
      passed++;
      console.log(`  ✓ ${t.name}`);
    } catch (e: any) {
      failed++;
      console.error(`  ✗ ${t.name}`);
      console.error(`    ${e?.message ?? e}`);
    }
  }
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

function freshEvidenceStore(): string {
  counter++;
  const dir = path.join(os.tmpdir(), `b4b-gateway-${process.pid}-${counter}`);
  initExecutionEvidenceStore(dir);
  return dir;
}

function provisionKey(opts: { name: string; allowedModels: string[] }): { fullKey: string; key: TeleGptApiKey } {
  return createApiKey({
    name: opts.name,
    allowedModels: opts.allowedModels,
    permissions: { chat: true, tools: false, streaming: false },
  });
}

async function postChat(
  app: ReturnType<typeof Fastify>,
  opts: { model: string; messages: Array<{ role: string; content: string }>; auth?: string | null; stream?: boolean },
): Promise<{ status: number; data: any }> {
  const addr = app.server.address() as any;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.auth !== undefined) headers.authorization = opts.auth as string;
  const body = { model: opts.model, messages: opts.messages, ...(opts.stream ? { stream: true } : {}) };
  const resp = await fetch(`http://127.0.0.1:${addr.port}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  return { status: resp.status, data };
}

console.log("\nPD-W3/B4-B Authenticated Local Provider Chat (gateway):");

console.log("\nG0. exact model gating");

test("G0. only the exact local:local-chat alias is eligible for the slice", () => {
  assert.equal(isProviderChatModel("local:local-chat"), true);
  assert.equal(isProviderChatModel(" local:local-chat "), true);
  assert.equal(isProviderChatModel("local:llm"), false, "other local:* aliases are NOT blanket-migrated");
  assert.equal(isProviderChatModel("local-demo"), false, "demo stays on its own slice");
  assert.equal(isProviderChatModel("kimi-k2-turbo"), false);
  assert.equal(isProviderChatModel(null), false);
  assert.equal(isDemoModel("local:local-chat"), false, "provider-chat slice is not the demo slice");
});

console.log("\nG1. exact local:local-chat → Dispatch, routeChat = 0");

test("G1. local:local-chat POST → Dispatch evidence, no routeChat completion record", async () => {
  freshEvidenceStore();
  const { fullKey } = provisionKey({ name: "b4b-g1", allowedModels: ["local:local-chat"] });
  const app = Fastify({ logger: false });
  registerChatCompletionsRoute(app);
  await app.listen({ port: 0, host: "127.0.0.1" });

  const { status, data } = await postChat(app, {
    model: "local:local-chat",
    messages: [{ role: "user", content: "hello from B4B" }],
    auth: `Bearer ${fullKey}`,
  });

  assert.equal(status, 200);

  const traceId = getEvidenceByType("dispatch_started")[0]?.trace_id;
  assert.ok(traceId, "dispatch trace exists for the migrated slice");
  assert.ok(traceId.startsWith("req_"), "dispatch trace is the gateway request id");

  const types = getEvidenceByTrace(traceId).map((r) => r.type);
  assert.ok(types.includes("provider_decision_created"), "real Provider OS decision made");
  assert.ok(types.includes("dispatch_started"));
  assert.ok(types.includes("execution_started"));
  assert.ok(types.includes("execution_finished"));

  const all = readEvidenceRecords();
  const ids = all.map((r) => r.evidence_id);
  assert.ok(ids.includes(`ide.gateway.request.received-${traceId}`), "gateway surface event kept");
  assert.ok(ids.includes(`ide.gateway.model.resolved-${traceId}`), "gateway context_routed kept");
  assert.ok(
    !ids.includes(`ide.gateway.execution.completed-${traceId}`),
    "no routeChat completion record — routeChat call count = 0 for the migrated slice",
  );
  assert.ok(!ids.some((id) => id.startsWith(`ide.gateway.execution.failed-${traceId}`)));
  await app.close();
});

test("G2. output equals the canonical localChat leaf and is deterministic", async () => {
  freshEvidenceStore();
  const { fullKey } = provisionKey({ name: "b4b-g2", allowedModels: ["local:local-chat"] });
  const app = Fastify({ logger: false });
  registerChatCompletionsRoute(app);
  await app.listen({ port: 0, host: "127.0.0.1" });

  const a = await postChat(app, {
    model: "local:local-chat",
    messages: [{ role: "user", content: "determinism check" }],
    auth: `Bearer ${fullKey}`,
  });
  const b = await postChat(app, {
    model: "local:local-chat",
    messages: [{ role: "user", content: "determinism check" }],
    auth: `Bearer ${fullKey}`,
  });

  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(
    a.data.choices?.[0]?.message?.content,
    b.data.choices[0].message.content,
    "offline deterministic",
  );

  const direct = await chat({ message: "determinism check", model: "local:local-chat" });
  assert.equal(
    a.data.choices[0].message.content,
    direct.output,
    "output equals the canonical localChat transport leaf, not any legacy seam",
  );

  assert.equal(getEvidenceByType("dispatch_started").length, 2, "two requests → two dispatch executions");
  await app.close();
});

console.log("\nG3. response compatibility");

test("G3. OpenAI-compatible response contract preserved for the migrated slice", async () => {
  freshEvidenceStore();
  const { fullKey } = provisionKey({ name: "b4b-g3", allowedModels: ["local:local-chat"] });
  const app = Fastify({ logger: false });
  registerChatCompletionsRoute(app);
  await app.listen({ port: 0, host: "127.0.0.1" });

  const { status, data } = await postChat(app, {
    model: "local:local-chat",
    messages: [{ role: "user", content: "compat" }],
    auth: `Bearer ${fullKey}`,
  });

  assert.equal(status, 200);
  assert.ok(data.id, "id present");
  assert.equal(data.object, "chat.completion");
  assert.equal(data.model, "local:local-chat", "requested model attribution");
  assert.ok(Array.isArray(data.choices) && data.choices.length === 1);
  assert.equal(data.choices[0].message.role, "assistant");
  assert.equal(data.choices[0].finish_reason, "stop");
  assert.ok(typeof data.choices[0].message.content === "string");
  await app.close();
});

console.log("\nG4. security invariants");

test("G4. missing/invalid auth → 401 before dispatch", async () => {
  freshEvidenceStore();
  const app = Fastify({ logger: false });
  registerChatCompletionsRoute(app);
  await app.listen({ port: 0, host: "127.0.0.1" });

  const missing = await postChat(app, {
    model: "local:local-chat",
    messages: [{ role: "user", content: "x" }],
    auth: null,
  });
  const invalid = await postChat(app, {
    model: "local:local-chat",
    messages: [{ role: "user", content: "x" }],
    auth: "Bearer sk-not-a-gateway-key",
  });

  assert.equal(missing.status, 401);
  assert.equal(invalid.status, 401);
  assert.equal(getEvidenceByType("dispatch_started").length, 0, "no dispatch without verified identity");
  await app.close();
});

test("G5. model allowlist → 403 before dispatch, unchanged", async () => {
  freshEvidenceStore();
  const { fullKey } = provisionKey({ name: "b4b-g5", allowedModels: ["kimi-k2-turbo"] });
  const app = Fastify({ logger: false });
  registerChatCompletionsRoute(app);
  await app.listen({ port: 0, host: "127.0.0.1" });

  const { status, data } = await postChat(app, {
    model: "local:local-chat",
    messages: [{ role: "user", content: "x" }],
    auth: `Bearer ${fullKey}`,
  });

  assert.equal(status, 403);
  assert.equal(data.error?.type, "permission_denied");
  assert.equal(getEvidenceByType("dispatch_started").length, 0);
  await app.close();
});

test("G6. stream:true → 400 not_supported, unchanged", async () => {
  freshEvidenceStore();
  const { fullKey } = provisionKey({ name: "b4b-g6", allowedModels: ["local:local-chat"] });
  const app = Fastify({ logger: false });
  registerChatCompletionsRoute(app);
  await app.listen({ port: 0, host: "127.0.0.1" });

  const { status, data } = await postChat(app, {
    model: "local:local-chat",
    messages: [{ role: "user", content: "x" }],
    auth: `Bearer ${fullKey}`,
    stream: true,
  });

  assert.equal(status, 400);
  assert.equal(data.error?.type, "not_supported");
  assert.equal(getEvidenceByType("dispatch_started").length, 0);
  await app.close();
});

console.log("\nG7. legacy and demo lanes unchanged");

test("G7. non-provider-chat local model stays on legacy routeChat with its own completion record", async () => {
  freshEvidenceStore();
  const beforeBase = process.env.LOCAL_OPENAI_BASE_URL;
  process.env.LOCAL_OPENAI_BASE_URL = "";
  const { fullKey } = provisionKey({ name: "b4b-g7", allowedModels: ["local-model"] });
  const app = Fastify({ logger: false });
  registerChatCompletionsRoute(app);
  await app.listen({ port: 0, host: "127.0.0.1" });

  try {
    const { status, data } = await postChat(app, {
      model: "local-model",
      messages: [{ role: "user", content: "legacy only" }],
      auth: `Bearer ${fullKey}`,
    });
    assert.equal(status, 200);
    assert.ok((data.choices?.[0]?.message?.content ?? "").includes("Привет! Я здесь"));
    await app.close();
  } finally {
    if (beforeBase === undefined) delete process.env.LOCAL_OPENAI_BASE_URL;
    else process.env.LOCAL_OPENAI_BASE_URL = beforeBase;
  }

  assert.equal(getEvidenceByType("dispatch_started").length, 0, "legacy slice produced no dispatch");
  const gatewayCompleted = getEvidenceByType("execution_completed").filter((r) =>
    r.evidence_id.startsWith("ide.gateway.execution.completed-"),
  );
  assert.equal(gatewayCompleted.length, 1, "legacy path kept its own gateway completion record");
});

test("G8. demo slice (local-demo) behavior unchanged", async () => {
  freshEvidenceStore();
  const { fullKey } = provisionKey({ name: "b4b-g8", allowedModels: ["local-demo"] });
  const app = Fastify({ logger: false });
  registerChatCompletionsRoute(app);
  await app.listen({ port: 0, host: "127.0.0.1" });

  const { status, data } = await postChat(app, {
    model: "local-demo",
    messages: [{ role: "user", content: "demo unchanged" }],
    auth: `Bearer ${fullKey}`,
  });

  assert.equal(status, 200);
  assert.equal(data.model, "local-demo");
  assert.equal(data.choices?.[0]?.message?.content, "Tele•GPT говорит: demo unchanged");
  const dispatch = getEvidenceByType("dispatch_started");
  assert.equal(dispatch.length, 1, "demo still dispatches via the demo slice");
  await app.close();
});

console.log("\nG9. controlled localhost OpenAI-compatible transport fixture");

test("G9. HTTP transport proven with a controlled localhost fixture", async () => {
  freshEvidenceStore();
  const fixtureServer = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      assert.ok(body.includes(`"model"`), "fixture received a model field");
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          message: { content: "fixture reply from controlled transport" },
          usage: { prompt_tokens: 11, completion_tokens: 7 },
        }),
      );
    });
  });
  await new Promise<void>((resolve) => fixtureServer.listen(0, "127.0.0.1", resolve));
  const port = (fixtureServer.address() as any).port;

  const beforeBase = process.env.LOCAL_OPENAI_BASE_URL;
  const beforeKey = process.env.LOCAL_OPENAI_API_KEY;
  process.env.LOCAL_OPENAI_BASE_URL = `http://127.0.0.1:${port}`;
  process.env.LOCAL_OPENAI_API_KEY = "test-key";

  const { fullKey } = provisionKey({ name: "b4b-g9", allowedModels: ["local:local-chat"] });
  const app = Fastify({ logger: false });
  registerChatCompletionsRoute(app);
  await app.listen({ port: 0, host: "127.0.0.1" });

  try {
    const { status, data } = await postChat(app, {
      model: "local:local-chat",
      messages: [{ role: "user", content: "use the real transport" }],
      auth: `Bearer ${fullKey}`,
    });

    assert.equal(status, 200);
    assert.equal(
      data.choices?.[0]?.message?.content,
      "fixture reply from controlled transport",
      "real HTTP transport executed through Dispatch",
    );
    assert.equal(data.usage?.prompt_tokens, 11, "usage facts preserved from transport");
    assert.equal(data.usage?.completion_tokens, 7);
    assert.equal(getEvidenceByType("dispatch_started").length, 1);
    await app.close();
  } finally {
    fixtureServer.close();
    if (beforeBase === undefined) delete process.env.LOCAL_OPENAI_BASE_URL;
    else process.env.LOCAL_OPENAI_BASE_URL = beforeBase;
    if (beforeKey === undefined) delete process.env.LOCAL_OPENAI_API_KEY;
    else process.env.LOCAL_OPENAI_API_KEY = beforeKey;
  }
});

void runTests();