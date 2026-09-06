// PD-W3/B2 — Authenticated gateway → Dispatch vNext integration.
// Run with: npx tsx tests/unit/gateway/gatewayDispatch.test.ts
//
// Proof targets:
// 1. A verified API key produces the canonical api:<id> actor (never payload).
// 2. An authenticated demo request executes through the canonical Dispatch
//    pipeline (real Provider OS decision + real executor output + canonical
//    evidence lifecycle) with NO duplicate gateway execution record.
// 3. Auth/model gates reject before Dispatch is ever reached.
// 4. Non-demo requests stay on the untouched legacy routeChat seam.

import assert from "node:assert/strict";
import Fastify from "fastify";
import os from "node:os";
import path from "node:path";
import { registerChatCompletionsRoute } from "../../../src/gateway/routes/chat-completions.js";
import {
  createApiKey,
  type TeleGptApiKey,
} from "../../../src/api-keys/store.js";
import {
  initExecutionEvidenceStore,
  getEvidenceByTrace,
  getEvidenceByType,
  readEvidenceRecords,
} from "../../../src/runtime/evidence/execution-evidence-store.js";
import { localDemo } from "../../../src/providers/local/demo.js";
import { isDemoModel, resolveGatewayActor } from "../../../src/gateway/dispatch-adapter.js";

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
  const dir = path.join(os.tmpdir(), `b2-gateway-dispatch-${process.pid}-${counter}`);
  initExecutionEvidenceStore(dir);
  return dir;
}

function provisionKey(opts: {
  name: string;
  allowedModels: string[];
}): { fullKey: string; key: TeleGptApiKey } {
  return createApiKey({
    name: opts.name,
    allowedModels: opts.allowedModels,
    permissions: { chat: true, tools: false, streaming: false },
  });
}

async function postChat(
  app: ReturnType<typeof Fastify>,
  opts: { model: string; messages: Array<{ role: string; content: string }>; auth?: string | null },
): Promise<{ status: number; data: any }> {
  const addr = app.server.address() as any;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.auth !== undefined) headers.authorization = opts.auth as string;
  const resp = await fetch(`http://127.0.0.1:${addr.port}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: opts.model, messages: opts.messages }),
  });
  const data = await resp.json().catch(() => ({}));
  return { status: resp.status, data };
}

console.log("\nPD-W3/B2 Authenticated Gateway Dispatch:");

console.log("\nU. trusted identity derivation");

test("U1. adapter derives canonical api actor only from the verified key id", () => {
  const { key } = provisionKey({ name: "b2-u1", allowedModels: ["local-demo"] });

  const trusted = resolveGatewayActor(key);
  assert.equal(trusted.subject, `api:${key.id}`);
  assert.equal(trusted.actor?.id, `api:${key.id}`);
  assert.equal(trusted.actor?.kind, "api");
  assert.equal(trusted.actor?.role, "public");
  assert.equal(trusted.source, "gateway.authentication.verified_api_key");
});

test("U2. only the local-demo slice is eligible for dispatch", () => {
  assert.equal(isDemoModel("local-demo"), true);
  assert.equal(isDemoModel(" local-demo "), true);
  assert.equal(isDemoModel("local:local-demo"), false, "legacy prefixed model stays on routeChat");
  assert.equal(isDemoModel("kimi-k2-turbo"), false);
  assert.equal(isDemoModel(""), false);
  assert.equal(isDemoModel(null), false);
});

console.log("\nE1. authenticated demo request executes through Dispatch vNext");

test("E1. demo POST → real executor output + canonical dispatch evidence, single lifecycle", async () => {
  freshEvidenceStore();
  const { fullKey } = provisionKey({ name: "b2-e1", allowedModels: ["local-demo"] });
  const app = Fastify({ logger: false });
  registerChatCompletionsRoute(app);
  await app.listen({ port: 0, host: "127.0.0.1" });

  const { status, data } = await postChat(app, {
    model: "local-demo",
    messages: [{ role: "user", content: "hello from B2" }],
    auth: `Bearer ${fullKey}`,
  });

  assert.equal(status, 200);
  assert.equal(data.model, "local-demo");
  assert.equal(data.choices?.[0]?.message?.content, "Tele•GPT говорит: hello from B2");

  const direct = await localDemo({ message: "hello from B2", model: "local-demo" });
  assert.equal(data.choices[0].message.content, direct.output, "output equals real localDemo provider output");

  await app.close();

  const dispatch = getEvidenceByType("dispatch_started");
  assert.equal(dispatch.length, 1, "exactly one canonical dispatch_started record");
  const traceId = dispatch[0].trace_id;
  assert.ok(traceId.startsWith("req_"), "dispatch trace is the gateway request id");

  const types = getEvidenceByTrace(traceId).map((r) => r.type);
  assert.ok(types.includes("provider_decision_created"), "real Provider OS decision evidence");
  assert.ok(types.includes("dispatch_started"));
  assert.ok(types.includes("execution_started"));
  assert.ok(types.includes("execution_finished"));
  const finished = getEvidenceByTrace(traceId).find((r) => r.type === "execution_finished");
  assert.equal(finished?.lifecycle_state, "completed");

  const all = readEvidenceRecords();
  const ids = all.map((r) => r.evidence_id);
  assert.ok(ids.includes(`ide.gateway.request.received-${traceId}`), "gateway request-received kept");
  assert.ok(ids.includes(`ide.gateway.model.resolved-${traceId}`), "gateway context_routed kept");
  assert.ok(
    !ids.includes(`ide.gateway.execution.completed-${traceId}`),
    "no duplicate gateway execution-recorded lifecycle for the dispatch slice",
  );
  assert.ok(
    !ids.some((id) => id.startsWith(`ide.gateway.execution.failed-${traceId}`)),
    "no gateway execution-failed lifecycle for the dispatch slice",
  );
});

test("E2. demo output is deterministic and equals direct localDemo", async () => {
  freshEvidenceStore();
  const { fullKey } = provisionKey({ name: "b2-e2", allowedModels: ["local-demo"] });
  const app = Fastify({ logger: false });
  registerChatCompletionsRoute(app);
  await app.listen({ port: 0, host: "127.0.0.1" });

  const a = await postChat(app, {
    model: "local-demo",
    messages: [{ role: "user", content: "determinism check" }],
    auth: `Bearer ${fullKey}`,
  });
  const b = await postChat(app, {
    model: "local-demo",
    messages: [{ role: "user", content: "determinism check" }],
    auth: `Bearer ${fullKey}`,
  });

  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(a.data.choices?.[0]?.message?.content, "Tele•GPT говорит: determinism check");
  assert.equal(b.data.choices?.[0]?.message?.content, a.data.choices[0].message.content);

  const direct = await localDemo({ message: "determinism check", model: "local-demo" });
  assert.equal(a.data.choices[0].message.content, direct.output);

  const dispatch = getEvidenceByType("dispatch_started");
  assert.equal(dispatch.length, 2, "two requests → two independent dispatch executions");
  await app.close();
});

console.log("\nE3. auth gates reject before Dispatch");

test("E3. missing or invalid bearer → 401, dispatch never reached", async () => {
  freshEvidenceStore();
  const app = Fastify({ logger: false });
  registerChatCompletionsRoute(app);
  await app.listen({ port: 0, host: "127.0.0.1" });

  const missing = await postChat(app, {
    model: "local-demo",
    messages: [{ role: "user", content: "x" }],
    auth: null,
  });
  const invalid = await postChat(app, {
    model: "local-demo",
    messages: [{ role: "user", content: "x" }],
    auth: "Bearer sk-not-a-gateway-key",
  });

  assert.equal(missing.status, 401);
  assert.equal(invalid.status, 401);
  assert.equal(getEvidenceByType("dispatch_started").length, 0, "no dispatch without verified identity");
  await app.close();
});

console.log("\nE4. model gate rejects before Dispatch");

test("E4. model not allowed for the key → 403, dispatch never reached", async () => {
  freshEvidenceStore();
  const { fullKey } = provisionKey({ name: "b2-e4", allowedModels: ["kimi-k2-turbo"] });
  const app = Fastify({ logger: false });
  registerChatCompletionsRoute(app);
  await app.listen({ port: 0, host: "127.0.0.1" });

  const { status, data } = await postChat(app, {
    model: "local-demo",
    messages: [{ role: "user", content: "x" }],
    auth: `Bearer ${fullKey}`,
  });

  assert.equal(status, 403);
  assert.equal(data.error?.type, "permission_denied");
  assert.equal(getEvidenceByType("dispatch_started").length, 0, "slice gating happens before dispatch");
  await app.close();
});

console.log("\nE5. non-demo requests stay on the untouched legacy routeChat seam");

test("E5. legacy model → routeChat offline reply, zero dispatch evidence", async () => {
  freshEvidenceStore();
  const beforeBase = process.env.LOCAL_OPENAI_BASE_URL;
  process.env.LOCAL_OPENAI_BASE_URL = "";
  const { fullKey } = provisionKey({ name: "b2-e5", allowedModels: ["local-model"] });
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
    assert.ok(
      (data.choices?.[0]?.message?.content ?? "").includes("Привет! Я здесь"),
      "legacy local offline reply, not dispatch",
    );

    await app.close();
  } finally {
    if (beforeBase === undefined) {
      delete process.env.LOCAL_OPENAI_BASE_URL;
    } else {
      process.env.LOCAL_OPENAI_BASE_URL = beforeBase;
    }
  }

  assert.equal(getEvidenceByType("dispatch_started").length, 0, "non-demo slice produced no dispatch");
  const gatewayCompleted = getEvidenceByType("execution_completed").filter(
    (r) => r.evidence_id.startsWith("ide.gateway.execution.completed-"),
  );
  assert.equal(gatewayCompleted.length, 1, "legacy path kept its own gateway completion record");
});

void runTests();