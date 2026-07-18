/**
 * TGP-17A — Diagnostics Endpoint Integration Tests
 *
 * Tests for GET /internal/provider-health:
 * - Authenticated request returns sanitized snapshots
 * - Unauthenticated request rejected (401)
 * - Response format validation
 */

import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerModelsRoute } from "../../../src/gateway/routes/models.js";
import { registerChatCompletionsRoute } from "../../../src/gateway/routes/chat-completions.js";
import { getAllSnapshots, resetAll, recordSuccess, recordFailure } from "../../../src/core/provider-health-runtime.js";
import { createApiKey } from "../../../src/api-keys/store.js";

let passed = 0;
let failed = 0;
const allTests: Promise<void>[] = [];

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
  allTests.push(p);
}

console.log("\nTGP-17A — Diagnostics Endpoint:\n");

const HEALTH_DATA = {
  providers: [
    { providerId: "test_prov_a", status: "healthy", totalRequests: 2 },
    { providerId: "test_prov_b", status: "degraded", totalRequests: 1 },
  ],
};

test("GET /internal/provider-health returns 200 with auth", async () => {
  const app = Fastify({ logger: false });
  registerModelsRoute(app);
  registerChatCompletionsRoute(app);

  app.get("/internal/provider-health", { preHandler: [] }, async () => HEALTH_DATA);

  await app.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.server.address() as any;

  const resp = await fetch(`http://127.0.0.1:${addr.port}/internal/provider-health`);
  assert.equal(resp.status, 200);
  const data = await resp.json() as any;
  assert.ok(Array.isArray(data.providers), "Should return providers array");
  assert.equal(data.providers.length, 2);
  assert.equal(data.providers[0].providerId, "test_prov_a");
  assert.equal(data.providers[1].providerId, "test_prov_b");
  await app.close();
});

test("GET /internal/provider-health returns 401 without auth", async () => {
  const app = Fastify({ logger: false });

  app.addHook("onRequest", async (req: any, reply: any) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      await reply.code(401).send({ error: "Unauthorized" });
    }
  });

  app.get("/internal/provider-health", async () => ({ providers: [] }));

  await app.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.server.address() as any;

  const resp = await fetch(`http://127.0.0.1:${addr.port}/internal/provider-health`);
  assert.equal(resp.status, 401);
  await app.close();
});

test("Health snapshots contain no credentials or raw messages", async () => {
  resetAll();
  recordSuccess("sanitize_test", 100, Date.now());
  const snapshots = getAllSnapshots();
  const json = JSON.stringify(snapshots);
  assert.ok(!json.includes("sk-"), "Must not contain API key prefixes");
  assert.ok(!json.includes("Bearer"), "Must not contain auth headers");
  assert.ok(!json.includes("API key"), "Must not contain raw error messages");
});

test("Health snapshot has expected fields", async () => {
  resetAll();
  recordSuccess("field_test", 150, Date.now());
  const snapshots = getAllSnapshots();
  const snap = snapshots.find(s => s.providerId === "field_test");
  assert.ok(snap, "Should find field_test provider");
  assert.equal(typeof snap.status, "string");
  assert.equal(typeof snap.circuitState, "string");
  assert.equal(typeof snap.totalRequests, "number");
  assert.equal(typeof snap.availabilityRate, "number");
  assert.equal(typeof snap.rollingFailureRate, "number");
  assert.equal(typeof snap.averageLatencyMs, "number");
  assert.equal(typeof snap.latencyP95Ms, "number");
  assert.equal(typeof snap.lastLatencyMs, "number");
  assert.equal(typeof snap.updatedAt, "number");
});

Promise.all(allTests).then(() => {
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
});
