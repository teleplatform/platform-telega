/**
 * Dispatcher API route tests.
 *
 * Boots a bare Fastify instance with only the dispatcher route registered
 * against a temp TELEGPT_DATA_DIR so registry state never leaks into the
 * real project DB. Covers the deterministic HTTP contract:
 *   200 success / 201 created / 400 invalid payload
 *   404 missing id / 409 duplicate id / 500 unexpected failure
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import Database from "better-sqlite3";
import { createSqliteDeviceRegistry } from "@tele-gpt/dispatcher-core";
import type { Device } from "@tele-gpt/dispatcher-core";

let dataDir: string;
let bootCount = 0;

before(() => {
  dataDir = mkdtempSync(join(tmpdir(), "dispatcher-api-"));
  bootCount = 0;
});

after(() => {
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

const { registerDispatcherRoute } = await import(
  "../../src/server/routes/dispatcher.route.js"
);

const validModel = {
  id: "llama-3-8b",
  name: "Llama 3 8B",
  family: "llama",
  version: "3.0",
  format: "gguf",
  status: "active",
  source: "registry",
  capabilities: ["text-generation"],
  manifest: { quant: "q4_k_m" },
};

const validProvider = {
  id: "openai",
  name: "OpenAI",
  kind: "cloud-api",
  enabled: true,
  priority: 10,
  baseUrl: "https://api.openai.com/v1",
  apiKeyEnv: "OPENAI_API_KEY",
  runtimeRefs: ["runtime-api"],
  costPerToken: { input: 0.001, output: 0.002 },
  capabilities: ["text-generation"],
};

const validRuntime = {
  id: "llama-cpp-local",
  name: "llama.cpp (local)",
  kind: "native-local",
  status: "available",
  endpoint: "http://127.0.0.1:8080",
  devices: ["dev-mac-m3"],
  supportedFormats: ["gguf"],
  maxConcurrent: 4,
  config: { threads: 8 },
};

const validRoutingRule = {
  id: "rule-low-latency",
  name: "Low latency first",
  priority: 10,
  enabled: true,
  condition: { capability: "reasoning", maxLatencyMs: 500 },
  action: { routeTo: "llama-cpp-local", fallback: "cloud-bridge" },
};

const validDevice: Device = {
  id: "dev-mac-m3",
  name: "Mac M3 Max",
  kind: "gpu",
  model: "Apple M3 Max",
  totalMemoryMb: 131072,
  usedMemoryMb: 32768,
  status: "available",
  runtimeRefs: ["llama-cpp-local"],
  metadata: { arch: "arm64" },
};

/**
 * Fresh DB per app instance so tests never observe another test's writes.
 * Returns the booted app and the path of its DB (used to seed devices).
 */
function freshDbPath(): string {
  return join(dataDir, `tele-gpt-${bootCount++}.sqlite`);
}

function bootApp() {
  const app = Fastify({ logger: false });
  const db = new Database(freshDbPath());
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return registerDispatcherRoute(app, db).then(() => app);
}

/** Boot a route app whose device registry is pre-seeded by discovery. */
async function bootAppWithDevices(devices: Device[]) {
  const app = Fastify({ logger: false });
  const db = new Database(freshDbPath());
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  await registerDispatcherRoute(app, db);
  createSqliteDeviceRegistry(db).seed(devices);
  return app;
}

describe("dispatcher API", () => {
  describe("models", () => {
    it("lists models (empty initially)", async () => {
      const app = await bootApp();
      const res = await app.inject({ method: "GET", url: "/dispatcher/models" });
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.json(), { items: [] });
    });

    it("creates a model (201) and returns it with timestamps", async () => {
      const app = await bootApp();
      const res = await app.inject({
        method: "POST",
        url: "/dispatcher/models",
        payload: validModel,
      });
      assert.equal(res.statusCode, 201);
      const body = res.json();
      assert.equal(body.id, validModel.id);
      assert.equal(body.format, "gguf");
      assert.ok(typeof body.createdAt === "string");
      assert.ok(typeof body.updatedAt === "string");
    });

    it("rejects a duplicate id (409)", async () => {
      const app = await bootApp();
      await app.inject({ method: "POST", url: "/dispatcher/models", payload: validModel });
      const res = await app.inject({
        method: "POST",
        url: "/dispatcher/models",
        payload: validModel,
      });
      assert.equal(res.statusCode, 409);
      assert.equal(res.json().error, "duplicate");
    });

    it("rejects invalid payloads (400)", async () => {
      const app = await bootApp();
      const missingId = await app.inject({
        method: "POST",
        url: "/dispatcher/models",
        payload: { name: "X", family: "x", version: "1", format: "gguf" },
      });
      assert.equal(missingId.statusCode, 400);
      assert.equal(missingId.json().error, "invalid_payload");

      const badFormat = await app.inject({
        method: "POST",
        url: "/dispatcher/models",
        payload: { ...validModel, format: "not-a-format" },
      });
      assert.equal(badFormat.statusCode, 400);

      const badCapabilities = await app.inject({
        method: "POST",
        url: "/dispatcher/models",
        payload: { ...validModel, capabilities: [42] },
      });
      assert.equal(badCapabilities.statusCode, 400);
    });

    it("gets a model by id (200) and misses (404)", async () => {
      const app = await bootApp();
      await app.inject({ method: "POST", url: "/dispatcher/models", payload: validModel });
      const ok = await app.inject({ method: "GET", url: "/dispatcher/models/llama-3-8b" });
      assert.equal(ok.statusCode, 200);
      assert.equal(ok.json().name, validModel.name);

      const miss = await app.inject({ method: "GET", url: "/dispatcher/models/nope" });
      assert.equal(miss.statusCode, 404);
      assert.equal(miss.json().error, "not_found");
    });

    it("updates a model with partial payload (200) and misses (404)", async () => {
      const app = await bootApp();
      await app.inject({ method: "POST", url: "/dispatcher/models", payload: validModel });
      const up = await app.inject({
        method: "PUT",
        url: "/dispatcher/models/llama-3-8b",
        payload: { name: "Llama 3 8B Instruct" },
      });
      assert.equal(up.statusCode, 200);
      assert.equal(up.json().name, "Llama 3 8B Instruct");
      assert.equal(up.json().id, validModel.id);

      const miss = await app.inject({
        method: "PUT",
        url: "/dispatcher/models/nope",
        payload: { name: "X" },
      });
      assert.equal(miss.statusCode, 404);
    });

    it("removes a model (200) and misses (404)", async () => {
      const app = await bootApp();
      await app.inject({ method: "POST", url: "/dispatcher/models", payload: validModel });
      const del = await app.inject({
        method: "DELETE",
        url: "/dispatcher/models/llama-3-8b",
      });
      assert.equal(del.statusCode, 200);
      assert.equal(del.json().removed, true);

      const miss = await app.inject({
        method: "DELETE",
        url: "/dispatcher/models/llama-3-8b",
      });
      assert.equal(miss.statusCode, 404);

      const list = await app.inject({ method: "GET", url: "/dispatcher/models" });
      assert.equal(list.statusCode, 200);
      assert.deepEqual(list.json(), { items: [] });
    });

    it("ignores non-object bodies on PUT", async () => {
      const app = await bootApp();
      await app.inject({ method: "POST", url: "/dispatcher/models", payload: validModel });
      const res = await app.inject({
        method: "PUT",
        url: "/dispatcher/models/llama-3-8b",
        payload: null,
      });
      assert.equal(res.statusCode, 200);
      assert.equal(res.json().name, validModel.name);
    });
  });

  describe("providers", () => {
    it("creates a provider (201) and lists it", async () => {
      const app = await bootApp();
      const res = await app.inject({
        method: "POST",
        url: "/dispatcher/providers",
        payload: validProvider,
      });
      assert.equal(res.statusCode, 201);
      const body = res.json();
      assert.equal(body.kind, "cloud-api");
      assert.equal(body.priority, 10);
      assert.equal(body.apiKeyEnv, "OPENAI_API_KEY");

      const list = await app.inject({ method: "GET", url: "/dispatcher/providers" });
      assert.equal(list.statusCode, 200);
      assert.equal(list.json().items.length, 1);
    });

    it("rejects a duplicate id (409) and invalid kind (400)", async () => {
      const app = await bootApp();
      await app.inject({ method: "POST", url: "/dispatcher/providers", payload: validProvider });
      const dup = await app.inject({
        method: "POST",
        url: "/dispatcher/providers",
        payload: validProvider,
      });
      assert.equal(dup.statusCode, 409);

      const badKind = await app.inject({
        method: "POST",
        url: "/dispatcher/providers",
        payload: { ...validProvider, id: "o2", kind: "warp-anchor" },
      });
      assert.equal(badKind.statusCode, 400);

      const badCost = await app.inject({
        method: "POST",
        url: "/dispatcher/providers",
        payload: { ...validProvider, id: "o3", costPerToken: { input: "free" } },
      });
      assert.equal(badCost.statusCode, 400);
    });

    it("reports provider health (200) and validates the body (400)", async () => {
      const app = await bootApp();
      await app.inject({ method: "POST", url: "/dispatcher/providers", payload: validProvider });
      const res = await app.inject({
        method: "POST",
        url: "/dispatcher/providers/openai/health",
        payload: {
          status: "healthy",
          latencyMs: 120,
          errorRate: 0.01,
          successCount: 10,
          failCount: 0,
        },
      });
      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.equal(body.health.status, "healthy");
      assert.equal(body.health.latencyMs, 120);
      assert.ok(typeof body.health.lastCheck === "string");

      const miss = await app.inject({
        method: "POST",
        url: "/dispatcher/providers/no-such/health",
        payload: { status: "healthy" },
      });
      assert.equal(miss.statusCode, 404);

      const bad = await app.inject({
        method: "POST",
        url: "/dispatcher/providers/openai/health",
        payload: { status: "nuked", latencyMs: -5 },
      });
      assert.equal(bad.statusCode, 400);
    });

    it("updates a provider (200) and misses (404)", async () => {
      const app = await bootApp();
      await app.inject({ method: "POST", url: "/dispatcher/providers", payload: validProvider });
      const up = await app.inject({
        method: "PUT",
        url: "/dispatcher/providers/openai",
        payload: { priority: 5, enabled: false },
      });
      assert.equal(up.statusCode, 200);
      assert.equal(up.json().priority, 5);
      assert.equal(up.json().enabled, false);

      const miss = await app.inject({
        method: "PUT",
        url: "/dispatcher/providers/grok",
        payload: { priority: 1 },
      });
      assert.equal(miss.statusCode, 404);
    });

    it("removes a provider (200) and misses (404)", async () => {
      const app = await bootApp();
      await app.inject({ method: "POST", url: "/dispatcher/providers", payload: validProvider });
      const del = await app.inject({
        method: "DELETE",
        url: "/dispatcher/providers/openai",
      });
      assert.equal(del.statusCode, 200);

      const miss = await app.inject({
        method: "DELETE",
        url: "/dispatcher/providers/openai",
      });
      assert.equal(miss.statusCode, 404);
    });
  });

  describe("runtimes", () => {
    it("lists runtimes (empty initially)", async () => {
      const app = await bootApp();
      const res = await app.inject({ method: "GET", url: "/dispatcher/runtimes" });
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.json(), { items: [] });
    });

    it("creates a runtime (201) with defaults applied", async () => {
      const app = await bootApp();
      const res = await app.inject({
        method: "POST",
        url: "/dispatcher/runtimes",
        payload: validRuntime,
      });
      assert.equal(res.statusCode, 201);
      const body = res.json();
      assert.equal(body.id, validRuntime.id);
      assert.equal(body.kind, "native-local");
      assert.equal(body.status, "available");
      assert.equal(body.maxConcurrent, 4);
      assert.deepEqual(body.devices, ["dev-mac-m3"]);
      assert.ok(typeof body.createdAt === "string");
    });

    it("rejects a duplicate id (409)", async () => {
      const app = await bootApp();
      await app.inject({ method: "POST", url: "/dispatcher/runtimes", payload: validRuntime });
      const res = await app.inject({
        method: "POST",
        url: "/dispatcher/runtimes",
        payload: validRuntime,
      });
      assert.equal(res.statusCode, 409);
      assert.equal(res.json().error, "duplicate");
    });

    it("rejects invalid payloads (400)", async () => {
      const app = await bootApp();
      const missingId = await app.inject({
        method: "POST",
        url: "/dispatcher/runtimes",
        payload: { name: "X", kind: "native-local" },
      });
      assert.equal(missingId.statusCode, 400);
      assert.equal(missingId.json().error, "invalid_payload");

      const badKind = await app.inject({
        method: "POST",
        url: "/dispatcher/runtimes",
        payload: { ...validRuntime, id: "r2", kind: "warp-engine" },
      });
      assert.equal(badKind.statusCode, 400);

      const badFormat = await app.inject({
        method: "POST",
        url: "/dispatcher/runtimes",
        payload: { ...validRuntime, id: "r3", supportedFormats: ["torchscript"] },
      });
      assert.equal(badFormat.statusCode, 400);

      const badConcurrent = await app.inject({
        method: "POST",
        url: "/dispatcher/runtimes",
        payload: { ...validRuntime, id: "r4", maxConcurrent: 0 },
      });
      assert.equal(badConcurrent.statusCode, 400);
    });

    it("gets a runtime by id (200) and misses (404)", async () => {
      const app = await bootApp();
      await app.inject({ method: "POST", url: "/dispatcher/runtimes", payload: validRuntime });
      const ok = await app.inject({
        method: "GET",
        url: "/dispatcher/runtimes/llama-cpp-local",
      });
      assert.equal(ok.statusCode, 200);
      assert.equal(ok.json().name, validRuntime.name);

      const miss = await app.inject({ method: "GET", url: "/dispatcher/runtimes/nope" });
      assert.equal(miss.statusCode, 404);
      assert.equal(miss.json().error, "not_found");
    });

    it("updates a runtime (200) and misses (404)", async () => {
      const app = await bootApp();
      await app.inject({ method: "POST", url: "/dispatcher/runtimes", payload: validRuntime });
      const up = await app.inject({
        method: "PUT",
        url: "/dispatcher/runtimes/llama-cpp-local",
        payload: { status: "busy", maxConcurrent: 8 },
      });
      assert.equal(up.statusCode, 200);
      assert.equal(up.json().status, "busy");
      assert.equal(up.json().maxConcurrent, 8);

      const miss = await app.inject({
        method: "PUT",
        url: "/dispatcher/runtimes/nope",
        payload: { status: "busy" },
      });
      assert.equal(miss.statusCode, 404);
    });

    it("removes a runtime (200) and misses (404)", async () => {
      const app = await bootApp();
      await app.inject({ method: "POST", url: "/dispatcher/runtimes", payload: validRuntime });
      const del = await app.inject({
        method: "DELETE",
        url: "/dispatcher/runtimes/llama-cpp-local",
      });
      assert.equal(del.statusCode, 200);
      assert.equal(del.json().removed, true);

      const miss = await app.inject({
        method: "DELETE",
        url: "/dispatcher/runtimes/llama-cpp-local",
      });
      assert.equal(miss.statusCode, 404);
    });
  });

  describe("devices", () => {
    it("lists devices (empty until discovery feeds the registry)", async () => {
      const app = await bootApp();
      const res = await app.inject({ method: "GET", url: "/dispatcher/devices" });
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.json(), { items: [] });
    });

    it("lists discovered devices and gets one by id (200)", async () => {
      const app = await bootAppWithDevices([validDevice]);
      const list = await app.inject({ method: "GET", url: "/dispatcher/devices" });
      assert.equal(list.statusCode, 200);
      assert.equal(list.json().items.length, 1);
      assert.equal(list.json().items[0].kind, "gpu");

      const ok = await app.inject({ method: "GET", url: "/dispatcher/devices/dev-mac-m3" });
      assert.equal(ok.statusCode, 200);
      assert.equal(ok.json().model, "Apple M3 Max");
    });

    it("misses on an unknown device (404)", async () => {
      const app = await bootAppWithDevices([validDevice]);
      const miss = await app.inject({ method: "GET", url: "/dispatcher/devices/nope" });
      assert.equal(miss.statusCode, 404);
      assert.equal(miss.json().error, "not_found");
    });

    it("updates a discovered device (200) and misses (404)", async () => {
      const app = await bootAppWithDevices([validDevice]);
      const up = await app.inject({
        method: "PUT",
        url: "/dispatcher/devices/dev-mac-m3",
        payload: { status: "busy", usedMemoryMb: 49152 },
      });
      assert.equal(up.statusCode, 200);
      assert.equal(up.json().status, "busy");
      assert.equal(up.json().usedMemoryMb, 49152);

      const miss = await app.inject({
        method: "PUT",
        url: "/dispatcher/devices/nope",
        payload: { status: "busy" },
      });
      assert.equal(miss.statusCode, 404);
    });

    it("has no create or delete endpoints (devices are discovered, not user-created)", async () => {
      const app = await bootApp();
      const post = await app.inject({
        method: "POST",
        url: "/dispatcher/devices",
        payload: validDevice,
      });
      assert.equal(post.statusCode, 404);

      const del = await app.inject({ method: "DELETE", url: "/dispatcher/devices/dev-mac-m3" });
      assert.equal(del.statusCode, 404);
    });
  });

  describe("routing", () => {
    it("lists routing rules (empty initially)", async () => {
      const app = await bootApp();
      const res = await app.inject({ method: "GET", url: "/dispatcher/routing" });
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.json(), { items: [] });
    });

    it("creates a routing rule (201) with condition/action payloads", async () => {
      const app = await bootApp();
      const res = await app.inject({
        method: "POST",
        url: "/dispatcher/routing",
        payload: validRoutingRule,
      });
      assert.equal(res.statusCode, 201);
      const body = res.json();
      assert.equal(body.id, validRoutingRule.id);
      assert.equal(body.priority, 10);
      assert.equal(body.enabled, true);
      assert.deepEqual(body.condition, { capability: "reasoning", maxLatencyMs: 500 });
      assert.deepEqual(body.action, { routeTo: "llama-cpp-local", fallback: "cloud-bridge" });
    });

    it("rejects a duplicate id (409)", async () => {
      const app = await bootApp();
      await app.inject({
        method: "POST",
        url: "/dispatcher/routing",
        payload: validRoutingRule,
      });
      const res = await app.inject({
        method: "POST",
        url: "/dispatcher/routing",
        payload: validRoutingRule,
      });
      assert.equal(res.statusCode, 409);
      assert.equal(res.json().error, "duplicate");
    });

    it("rejects invalid payloads (400)", async () => {
      const app = await bootApp();
      const missingId = await app.inject({
        method: "POST",
        url: "/dispatcher/routing",
        payload: { name: "X" },
      });
      assert.equal(missingId.statusCode, 400);
      assert.equal(missingId.json().error, "invalid_payload");

      const badPriority = await app.inject({
        method: "POST",
        url: "/dispatcher/routing",
        payload: { ...validRoutingRule, id: "r2", priority: -1 },
      });
      assert.equal(badPriority.statusCode, 400);

      const missingAction = await app.inject({
        method: "POST",
        url: "/dispatcher/routing",
        payload: { ...validRoutingRule, id: "r3", action: {} },
      });
      assert.equal(missingAction.statusCode, 400);

      const badCondition = await app.inject({
        method: "POST",
        url: "/dispatcher/routing",
        payload: { ...validRoutingRule, id: "r4", condition: { maxLatencyMs: "fast" } },
      });
      assert.equal(badCondition.statusCode, 400);

      const badCapability = await app.inject({
        method: "POST",
        url: "/dispatcher/routing",
        payload: { ...validRoutingRule, id: "r5", condition: { capability: "telepathy" } },
      });
      assert.equal(badCapability.statusCode, 400);

      const badWeight = await app.inject({
        method: "POST",
        url: "/dispatcher/routing",
        payload: { ...validRoutingRule, id: "r6", action: { routeTo: "x", weight: -2 } },
      });
      assert.equal(badWeight.statusCode, 400);
    });

    it("gets a routing rule by id (200) and misses (404)", async () => {
      const app = await bootApp();
      await app.inject({
        method: "POST",
        url: "/dispatcher/routing",
        payload: validRoutingRule,
      });
      const ok = await app.inject({
        method: "GET",
        url: "/dispatcher/routing/rule-low-latency",
      });
      assert.equal(ok.statusCode, 200);
      assert.equal(ok.json().name, validRoutingRule.name);

      const miss = await app.inject({ method: "GET", url: "/dispatcher/routing/nope" });
      assert.equal(miss.statusCode, 404);
      assert.equal(miss.json().error, "not_found");
    });

    it("updates a routing rule with partial payload (200) and misses (404)", async () => {
      const app = await bootApp();
      await app.inject({
        method: "POST",
        url: "/dispatcher/routing",
        payload: validRoutingRule,
      });
      const up = await app.inject({
        method: "PUT",
        url: "/dispatcher/routing/rule-low-latency",
        payload: { enabled: false, priority: 3 },
      });
      assert.equal(up.statusCode, 200);
      assert.equal(up.json().enabled, false);
      assert.equal(up.json().priority, 3);

      const miss = await app.inject({
        method: "PUT",
        url: "/dispatcher/routing/nope",
        payload: { enabled: false },
      });
      assert.equal(miss.statusCode, 404);
    });

    it("removes a routing rule (200) and misses (404)", async () => {
      const app = await bootApp();
      await app.inject({
        method: "POST",
        url: "/dispatcher/routing",
        payload: validRoutingRule,
      });
      const del = await app.inject({
        method: "DELETE",
        url: "/dispatcher/routing/rule-low-latency",
      });
      assert.equal(del.statusCode, 200);
      assert.equal(del.json().removed, true);

      const miss = await app.inject({
        method: "DELETE",
        url: "/dispatcher/routing/rule-low-latency",
      });
      assert.equal(miss.statusCode, 404);
    });

    it("lists rules in deterministic order: priority DESC, then id ASC", async () => {
      const app = await bootApp();
      await app.inject({
        method: "POST",
        url: "/dispatcher/routing",
        payload: { ...validRoutingRule, id: "rule-b", priority: 5 },
      });
      await app.inject({
        method: "POST",
        url: "/dispatcher/routing",
        payload: { ...validRoutingRule, id: "rule-a", priority: 5 },
      });
      await app.inject({
        method: "POST",
        url: "/dispatcher/routing",
        payload: { ...validRoutingRule, id: "rule-top", priority: 50 },
      });

      const list = await app.inject({ method: "GET", url: "/dispatcher/routing" });
      assert.equal(list.statusCode, 200);
      assert.deepEqual(list.json().items.map((r: { id: string }) => r.id), ["rule-top", "rule-a", "rule-b"]);
    });
  });

  describe("routing explain", () => {
    it("reports an exact match with reasons and the configured routeTo", async () => {
      const app = await bootApp();
      await app.inject({
        method: "POST",
        url: "/dispatcher/routing",
        payload: {
          id: "rule-vision-proxy",
          name: "Vision to local proxy",
          priority: 10,
          enabled: true,
          condition: { capability: "vision", providerKind: "local-proxy" },
          action: { routeTo: "ai-station-proxy", fallback: "cloud-bridge" },
        },
      });
      const res = await app.inject({
        method: "POST",
        url: "/dispatcher/routing/explain",
        payload: { capability: "vision", providerKind: "local-proxy" },
      });
      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.equal(body.outcome, "matched");
      assert.equal(body.winner.ruleId, "rule-vision-proxy");
      assert.equal(body.winner.routeTo, "ai-station-proxy");
      assert.equal(body.winner.fallback, "cloud-bridge");
      assert.equal(body.rules.length, 1);
      assert.equal(body.rules[0].matched, true);
      assert.ok(body.rules[0].reasons.every((r: { passed: boolean }) => r.passed));
    });

    it("reports a partial mismatch with failed-condition reasons", async () => {
      const app = await bootApp();
      await app.inject({
        method: "POST",
        url: "/dispatcher/routing",
        payload: {
          id: "rule-vision-proxy",
          name: "Vision to local proxy",
          priority: 10,
          enabled: true,
          condition: { capability: "vision", providerKind: "local-proxy" },
          action: { routeTo: "ai-station-proxy" },
        },
      });
      const res = await app.inject({
        method: "POST",
        url: "/dispatcher/routing/explain",
        payload: { capability: "reasoning" },
      });
      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.equal(body.outcome, "no_match");
      assert.equal(body.winner, undefined);
      const capability = body.rules[0].reasons.find((r: { field: string }) => r.field === "capability");
      assert.equal(capability.passed, false);
      assert.equal(capability.expected, "vision");
      assert.equal(capability.observed, "reasoning");
    });

    it("skips disabled rules and honors canonical order through the API", async () => {
      const app = await bootApp();
      await app.inject({
        method: "POST",
        url: "/dispatcher/routing",
        payload: {
          id: "rule-disabled",
          name: "Never wins",
          priority: 100,
          enabled: false,
          condition: {},
          action: { routeTo: "never" },
        },
      });
      await app.inject({
        method: "POST",
        url: "/dispatcher/routing",
        payload: {
          id: "rule-enabled",
          name: "Wins",
          priority: 50,
          enabled: true,
          condition: {},
          action: { routeTo: "works" },
        },
      });
      const res = await app.inject({
        method: "POST",
        url: "/dispatcher/routing/explain",
        payload: {},
      });
      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.equal(body.outcome, "matched");
      assert.equal(body.winner.ruleId, "rule-enabled");
      assert.equal(body.winner.routeTo, "works");
      assert.deepEqual(body.rules.map((r: { ruleId: string }) => r.ruleId), ["rule-disabled", "rule-enabled"]);
      const disabled = body.rules.find((r: { ruleId: string }) => r.ruleId === "rule-disabled");
      assert.equal(disabled.matched, false);
      assert.equal(disabled.reasons[0].field, "enabled");
    });

    it("returns an explicit no-match outcome for empty input", async () => {
      const app = await bootApp();
      await app.inject({
        method: "POST",
        url: "/dispatcher/routing",
        payload: {
          id: "rule-admin",
          name: "Admins",
          priority: 10,
          condition: { userRole: "admin" },
          action: { routeTo: "admin-proxy" },
        },
      });
      const res = await app.inject({
        method: "POST",
        url: "/dispatcher/routing/explain",
        payload: { userRole: "guest" },
      });
      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.equal(body.outcome, "no_match");
      assert.equal(body.winner, undefined);
      assert.equal(body.rules[0].matched, false);
    });

    it("rejects invalid explain input with 400", async () => {
      const app = await bootApp();
      const badCapability = await app.inject({
        method: "POST",
        url: "/dispatcher/routing/explain",
        payload: { capability: "telepathy" },
      });
      assert.equal(badCapability.statusCode, 400);
      assert.equal(badCapability.json().error, "invalid_payload");

      const badProviderKind = await app.inject({
        method: "POST",
        url: "/dispatcher/routing/explain",
        payload: { providerKind: "warp-anchor" },
      });
      assert.equal(badProviderKind.statusCode, 400);

      const badLatency = await app.inject({
        method: "POST",
        url: "/dispatcher/routing/explain",
        payload: { latencyMs: -5 },
      });
      assert.equal(badLatency.statusCode, 400);

      const nonObject = await app.inject({
        method: "POST",
        url: "/dispatcher/routing/explain",
        payload: [1, 2, 3],
      });
      assert.equal(nonObject.statusCode, 400);
    });

    it("is read-only: repeated explains never mutate the registry", async () => {
      const app = await bootApp();
      await app.inject({
        method: "POST",
        url: "/dispatcher/routing",
        payload: validRoutingRule,
      });
      await app.inject({
        method: "POST",
        url: "/dispatcher/routing/explain",
        payload: { capability: "reasoning" },
      });
      await app.inject({
        method: "POST",
        url: "/dispatcher/routing/explain",
        payload: { capability: "vision", latencyMs: 100 },
      });

      const list = await app.inject({ method: "GET", url: "/dispatcher/routing" });
      assert.equal(list.statusCode, 200);
      const items = list.json().items as Array<{ id: string }>;
      assert.equal(items.length, 1);
      assert.equal(items[0].id, validRoutingRule.id);
    });
  });
});