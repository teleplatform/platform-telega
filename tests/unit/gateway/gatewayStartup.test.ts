import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerModelsRoute } from "../../../src/gateway/routes/models.js";
import { registerChatCompletionsRoute } from "../../../src/gateway/routes/chat-completions.js";

let passed = 0;
let failed = 0;
const promises: Promise<void>[] = [];

function test(name: string, fn: () => void | Promise<void>) {
  const p = (async () => {
    try {
      await fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (e: any) {
      failed++;
      console.error(`  ✗ ${name}`);
      console.error(`    ${e.message}`);
    }
  })();
  promises.push(p);
}

console.log("\nGateway Startup Integration:");

test("Gateway starts without FST_ERR_DUPLICATED_ROUTE", async () => {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({ ok: true }));

  registerModelsRoute(app);
  registerChatCompletionsRoute(app);

  await app.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.server.address() as any;
  assert.ok(addr, "server should have an address");
  assert.ok(addr.port > 0, "server should be listening on a port");
  await app.close();
});

test("GET /v1/models returns 401 without auth", async () => {
  const app = Fastify({ logger: false });
  registerModelsRoute(app);

  await app.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.server.address() as any;
  const resp = await fetch(`http://127.0.0.1:${addr.port}/v1/models`);
  assert.equal(resp.status, 401);
  await app.close();
});

test("GET /health returns 200", async () => {
  const app = Fastify({ logger: false });
  app.get("/health", async () => ({ ok: true }));

  await app.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.server.address() as any;
  const resp = await fetch(`http://127.0.0.1:${addr.port}/health`);
  assert.equal(resp.status, 200);
  const data = await resp.json() as any;
  assert.equal(data.ok, true);
  await app.close();
});

test("POST /v1/chat/completions returns 401 without auth", async () => {
  const app = Fastify({ logger: false });
  registerChatCompletionsRoute(app);

  await app.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.server.address() as any;
  const resp = await fetch(`http://127.0.0.1:${addr.port}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "test", messages: [] }),
  });
  assert.equal(resp.status, 401);
  await app.close();
});

test("Duplicate route registration throws FST_ERR_DUPLICATED_ROUTE", async () => {
  const app = Fastify({ logger: false });
  registerModelsRoute(app);

  let threw = false;
  try {
    registerModelsRoute(app);
  } catch (e: any) {
    threw = true;
    assert.ok(e.message.includes("already declared") || e.code === "FST_ERR_DUPLICATED_ROUTE",
      `Expected FST_ERR_DUPLICATED_ROUTE, got: ${e.message}`);
  }
  assert.equal(threw, true, "Second registration should throw");
  await app.close();
});

Promise.all(promises).then(() => {
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
});
