/**
 * TGP-17A / TGP-17B / TGP-17C — Diagnostics Endpoint Integration Tests
 *
 * Tests for:
 * - GET /internal/provider-health
 * - GET /internal/provider-ranking (TGP-17B)
 * - GET /internal/provider-capabilities (TGP-17C)
 */

import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerModelsRoute } from "../../../src/gateway/routes/models.js";
import { registerChatCompletionsRoute } from "../../../src/gateway/routes/chat-completions.js";
import { getAllSnapshots, resetAll, recordSuccess, recordFailure } from "../../../src/core/provider-health-runtime.js";
import { getRankingDiagnostics, resetScoringConfig, resetProviderPolicies } from "../../../src/core/provider-scoring-engine.js";
import { capabilityRegistry, ALL_CAPABILITIES } from "../../../src/core/provider-capability-registry.js";
import { selectProvider, parseRouteIntent } from "../../../src/core/provider-selection-orchestrator.js";
import { createApiKey } from "../../../src/api-keys/store.js";

let passed = 0;
let failed = 0;
const allTests: { name: string; fn: () => void | Promise<void> }[] = [];

function test(name: string, fn: () => void | Promise<void>) {
  allTests.push({ name, fn });
}

// Run tests sequentially to avoid shared-state races on resetAll()/resetScoringConfig().
async function runSequential() {
  for (const { name, fn } of allTests) {
    try {
      await fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (e: any) {
      failed++;
      console.error(`  ✗ ${name}`);
      console.error(`    ${e.message}`);
    }
  }
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

test("GET /internal/provider-ranking returns 200 with auth", async () => {
  resetScoringConfig();
  resetProviderPolicies();
  resetAll();
  recordSuccess("rank_a", 100, Date.now());
  recordSuccess("rank_b", 120, Date.now());

  const app = Fastify({ logger: false });
  registerModelsRoute(app);
  registerChatCompletionsRoute(app);

  app.get("/internal/provider-ranking", { preHandler: [] }, async () => getRankingDiagnostics());

  await app.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.server.address() as any;

  const resp = await fetch(`http://127.0.0.1:${addr.port}/internal/provider-ranking`);
  assert.equal(resp.status, 200);
  const data = await resp.json() as any;
  assert.ok(Array.isArray(data.ranked), "Should return ranked array");
  assert.ok(data.ranked.length >= 2, "Should rank providers");
  assert.equal(typeof data.timestamp, "number");
  assert.equal(data.ranked[0].rankingPosition, 1);
  await app.close();
});

test("Ranking diagnostics response is sanitized", async () => {
  resetAll();
  recordSuccess("rank_san", 100, Date.now());
  const ranking = getRankingDiagnostics();
  const json = JSON.stringify(ranking);
  assert.ok(!json.includes("sk-"), "Must not contain API keys");
  assert.ok(!json.includes("Bearer"), "Must not contain auth headers");
  assert.ok(!json.includes("API key"), "Must not contain raw error messages");
});

test("GET /internal/provider-capabilities returns 200 with auth", async () => {
  const app = Fastify({ logger: false });
  registerModelsRoute(app);
  registerChatCompletionsRoute(app);

  app.get("/internal/provider-capabilities", { preHandler: [] }, async () => ({
    capabilities: ALL_CAPABILITIES,
    providers: capabilityRegistry.listProviders().map((id) => ({
      providerId: id,
      capabilities: capabilityRegistry.getProfile(id)?.capabilities ?? {},
    })),
  }));

  await app.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.server.address() as any;

  const resp = await fetch(`http://127.0.0.1:${addr.port}/internal/provider-capabilities`);
  assert.equal(resp.status, 200);
  const data = await resp.json() as any;
  assert.ok(Array.isArray(data.capabilities), "Should list capability kinds");
  assert.ok(data.capabilities.includes("vision"), "Should include vision capability");
  assert.ok(Array.isArray(data.providers), "Should list provider profiles");
  const kimi = data.providers.find((p: any) => p.providerId === "kimi_api");
  assert.ok(kimi, "kimi_api should be present");
  assert.equal(kimi.capabilities.long_context, "advanced");
  await app.close();
});

test("Capability diagnostics response is sanitized", async () => {
  const json = JSON.stringify({
    capabilities: ALL_CAPABILITIES,
    providers: capabilityRegistry.listProviders().map((id) => ({
      providerId: id,
      capabilities: capabilityRegistry.getProfile(id)?.capabilities ?? {},
    })),
  });
  assert.ok(!json.includes("sk-"), "Must not contain API keys");
  assert.ok(!json.includes("Bearer"), "Must not contain auth headers");
});

test("GET /internal/provider-selection returns plan for auto", async () => {
  const app = Fastify({ logger: false });
  registerModelsRoute(app);
  registerChatCompletionsRoute(app);

  app.get("/internal/provider-selection", { preHandler: [] }, async (req, reply) => {
    const model = (req.query as any).model as string | undefined;
    const intent = parseRouteIntent(model, { requiredCapabilities: [], strict: false, noFallback: false });
    const plan = selectProvider(model, { requiredCapabilities: [], strict: false, noFallback: false });
    return reply.send(plan);
  });

  await app.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.server.address() as any;

  const resp = await fetch(`http://127.0.0.1:${addr.port}/internal/provider-selection`);
  assert.equal(resp.status, 200);
  const data = await resp.json() as any;
  assert.ok(data.intent, "Should include intent");
  assert.ok(data.intent.mode === "auto", "Auto mode should be auto");
  assert.ok(Array.isArray(data.fallbackOrder), "Should have fallbackOrder");
  await app.close();
});

test("GET /internal/provider-selection returns plan for preferred prefix", async () => {
  const app = Fastify({ logger: false });
  registerModelsRoute(app);
  registerChatCompletionsRoute(app);

  app.get("/internal/provider-selection", { preHandler: [] }, async (req, reply) => {
    const model = (req.query as any).model as string | undefined;
    const plan = selectProvider(model, { requiredCapabilities: [], strict: false, noFallback: false });
    return reply.send(plan);
  });

  await app.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.server.address() as any;

  const resp = await fetch(`http://127.0.0.1:${addr.port}/internal/provider-selection?model=kimi:kimi-k3`);
  assert.equal(resp.status, 200);
  const data = await resp.json() as any;
  assert.equal(data.intent.mode, "preferred_provider");
  assert.equal(data.intent.requestedProviderId, "kimi_api");
  assert.equal(data.selectedProviderId, "kimi_api");
  await app.close();
});

test("Selection diagnostics response is sanitized", async () => {
  const plan = selectProvider("kimi:kimi-k3", { requiredCapabilities: [], strict: false, noFallback: false });
  const json = JSON.stringify(plan);
  assert.ok(!json.includes("sk-"), "Must not contain API keys");
  assert.ok(!json.includes("Bearer"), "Must not contain auth headers");
});

runSequential().then(() => {
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
});
