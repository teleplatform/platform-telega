/**
 * @tele-gpt/dispatcher-core — SQLite Registry Tests
 *
 * Validates Phase 3 requirements:
 *   - clean migration on a fresh DB
 *   - idempotent migration on an existing DB
 *   - CRUD for ModelRegistry
 *   - CRUD + health for ProviderRegistry
 *   - persistence survives process/repository re-instantiation
 *   - deterministic duplicate / missing id behavior
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

import {
  createDeviceRegistry,
  createModelRegistry,
  createProviderRegistry,
  createRoutingExplainer,
  createRoutingRegistry,
  createRuntimeRegistry,
  createSqliteDeviceRegistry,
  createSqliteModelRegistry,
  createSqliteProviderRegistry,
  createSqliteRoutingRegistry,
  createSqliteRuntimeRegistry,
  ensureDispatcherSchema,
  evaluateRoutingRules,
} from "../src/index.js";
import type {
  Capability,
  Device,
  ModelFormat,
  ModelManifest,
  ProviderConfig,
  RoutingExplainInput,
  RoutingRule,
  RuntimeConfig,
} from "../src/types.js";

type SqliteDb = Database.Database;

function memoryDb(): SqliteDb {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  return db;
}

function tempDbPath(): { dbPath: string; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), "dispatcher-core-"));
  return { dbPath: join(dir, "test.sqlite"), dir };
}

function cleanup(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

function tableNames(db: SqliteDb): string[] {
  const rows = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'dispatcher_%' ORDER BY name",
    )
    .all() as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

function modelFixture(overrides: Partial<ModelManifest> = {}): Omit<ModelManifest, "createdAt" | "updatedAt"> {
  return {
    id: "telega-intent-v0.1",
    name: "TeleGa Intent v0.1",
    family: "telega",
    version: "0.1.0",
    format: "gguf",
    status: "active",
    source: "registry",
    capabilities: ["reasoning", "tools"] as Capability[],
    manifest: { sizeBytes: 4096, quantization: "Q4_K_M" },
    ...overrides,
  };
}

function providerFixture(overrides: Partial<ProviderConfig> = {}): Omit<ProviderConfig, "createdAt"> {
  return {
    id: "openai-api",
    name: "OpenAI",
    kind: "cloud-api",
    enabled: true,
    priority: 1,
    health: { status: "healthy", lastCheck: "", successCount: 5, failCount: 0 },
    apiKeyEnv: "OPENAI_API_KEY",
    runtimeRefs: ["llama-cpp-local"],
    costPerToken: { input: 0.5, output: 1.5 },
    capabilities: ["reasoning", "tools", "vision"] as Capability[],
    ...overrides,
  };
}

function runtimeFixture(overrides: Partial<RuntimeConfig> = {}): Omit<RuntimeConfig, "createdAt"> {
  return {
    id: "llama-cpp-local",
    name: "llama.cpp (local)",
    kind: "native-local",
    status: "available",
    endpoint: "http://127.0.0.1:8080",
    devices: ["dev-mac-m3"],
    supportedFormats: ["gguf"] as ModelFormat[],
    maxConcurrent: 4,
    config: { threads: 8 },
    ...overrides,
  };
}

function deviceFixture(overrides: Partial<Device> = {}): Device {
  return {
    id: "dev-mac-m3",
    name: "Mac M3 Max",
    kind: "gpu",
    model: "Apple M3 Max",
    totalMemoryMb: 131072,
    usedMemoryMb: 32768,
    status: "available",
    runtimeRefs: ["llama-cpp-local"],
    metadata: { arch: "arm64" },
    ...overrides,
  };
}

function routingRuleFixture(overrides: Partial<RoutingRule> = {}): RoutingRule {
  return {
    id: "rule-low-latency",
    name: "Low latency first",
    priority: 10,
    condition: { capability: "reasoning", maxLatencyMs: 500 },
    action: { routeTo: "llama-cpp-local", fallback: "cloud-bridge" },
    enabled: true,
    ...overrides,
  };
}

describe("dispatcher schema migration", () => {
  it("creates tables on a fresh DB", () => {
    const db = memoryDb();
    ensureDispatcherSchema(db);
    const names = tableNames(db);
    assert.ok(names.includes("dispatcher_models"));
    assert.ok(names.includes("dispatcher_providers"));
    assert.ok(names.includes("dispatcher_runtimes"));
    assert.ok(names.includes("dispatcher_devices"));
    assert.ok(names.includes("dispatcher_routing_rules"));
    db.close();
  });

  it("is idempotent on an existing DB", () => {
    const db = memoryDb();
    ensureDispatcherSchema(db);
    ensureDispatcherSchema(db);
    ensureDispatcherSchema(db);
    const names = tableNames(db);
    assert.ok(names.includes("dispatcher_models"));
    assert.ok(names.includes("dispatcher_providers"));
    assert.ok(names.includes("dispatcher_runtimes"));
    assert.ok(names.includes("dispatcher_devices"));
    assert.ok(names.includes("dispatcher_routing_rules"));
    db.close();
  });

  it("stores only column + json for flexible fields", () => {
    const db = memoryDb();
    ensureDispatcherSchema(db);
    const cols = db
      .prepare("PRAGMA table_info(dispatcher_models)")
      .all() as Array<{ name: string }>;
    const colNames = cols.map((c) => c.name);
    assert.ok(colNames.includes("id"));
    assert.ok(colNames.includes("enabled") === false);
    // flexible fields stay in json columns
    assert.ok(colNames.includes("capabilities_json"));
    assert.ok(colNames.includes("manifest_json"));
    db.close();
  });
});

describe("SQLite ModelRegistry", () => {
  it("performs full CRUD", () => {
    const db = memoryDb();
    const reg = createSqliteModelRegistry(db);

    assert.equal(reg.list().length, 0);

    const created = reg.create(modelFixture());
    assert.equal(created.createdAt.length > 0, true);
    assert.equal(reg.list().length, 1);

    const fetched = reg.getById("telega-intent-v0.1");
    assert.ok(fetched);
    assert.equal(fetched.name, "TeleGa Intent v0.1");
    assert.deepEqual(fetched.capabilities, ["reasoning", "tools"]);

    const updated = reg.update("telega-intent-v0.1", { status: "experimental" });
    assert.ok(updated);
    assert.equal(updated.status, "experimental");
    assert.equal(reg.getById("telega-intent-v0.1")!.status, "experimental");
    assert.notEqual(updated.updatedAt, created.updatedAt);

    assert.equal(reg.remove("telega-intent-v0.1"), true);
    assert.equal(reg.list().length, 0);
    db.close();
  });

  it("throws on duplicate id", () => {
    const db = memoryDb();
    const reg = createSqliteModelRegistry(db);
    reg.create(modelFixture());
    assert.throws(() => reg.create(modelFixture()), /Model already exists: telega-intent-v0.1/);
    db.close();
  });

  it("returns deterministic results for missing ids", () => {
    const db = memoryDb();
    const reg = createSqliteModelRegistry(db);
    assert.equal(reg.getById("nope"), undefined);
    assert.equal(reg.update("nope", { name: "x" }), undefined);
    assert.equal(reg.remove("nope"), false);
    db.close();
  });
});

describe("SQLite ProviderRegistry", () => {
  it("performs full CRUD including health updates", () => {
    const db = memoryDb();
    const reg = createSqliteProviderRegistry(db);

    const created = reg.create(providerFixture());
    const fetched = reg.getById("openai-api");
    assert.ok(fetched);
    assert.equal(fetched.health.status, "healthy");
    assert.equal(fetched.enabled, true);
    assert.deepEqual(fetched.runtimeRefs, ["llama-cpp-local"]);
    assert.deepEqual(fetched.costPerToken, { input: 0.5, output: 1.5 });

    const updateHealth = reg.updateHealth("openai-api", {
      status: "down",
      lastCheck: new Date().toISOString(),
      successCount: 5,
      failCount: 3,
      errorRate: 0.37,
    });
    assert.ok(updateHealth);
    assert.equal(reg.getById("openai-api")!.health.status, "down");
    assert.equal(reg.getById("openai-api")!.health.failCount, 3);
    assert.equal(reg.getById("openai-api")!.health.errorRate, 0.37);

    const updated = reg.update("openai-api", { enabled: false, priority: 9 });
    assert.ok(updated);
    assert.equal(updated.enabled, false);
    assert.equal(reg.getById("openai-api")!.priority, 9);

    assert.equal(reg.remove("openai-api"), true);
    assert.equal(reg.list().length, 0);
    db.close();
  });

  it("throws on duplicate id", () => {
    const db = memoryDb();
    const reg = createSqliteProviderRegistry(db);
    reg.create(providerFixture());
    assert.throws(() => reg.create(providerFixture()), /Provider already exists: openai-api/);
    db.close();
  });

  it("returns deterministic results for missing ids", () => {
    const db = memoryDb();
    const reg = createSqliteProviderRegistry(db);
    assert.equal(reg.getById("nope"), undefined);
    assert.equal(reg.update("nope", { name: "x" }), undefined);
    assert.equal(reg.updateHealth("nope", {
      status: "down", lastCheck: "", successCount: 0, failCount: 0,
    }), undefined);
    assert.equal(reg.remove("nope"), false);
    db.close();
  });
});

describe("Persistence across re-instantiation", () => {
  it("survives db close/reopen for models", () => {
    const { dbPath, dir } = tempDbPath();
    try {
      const db1 = new Database(dbPath);
      const reg1 = createSqliteModelRegistry(db1);
      reg1.create(modelFixture());
      db1.close();

      const db2 = new Database(dbPath);
      const reg2 = createSqliteModelRegistry(db2);
      const reloaded = reg2.getById("telega-intent-v0.1");
      assert.ok(reloaded);
      assert.equal(reloaded.name, "TeleGa Intent v0.1");
      assert.deepEqual(reloaded.capabilities, ["reasoning", "tools"]);
      db2.close();
    } finally {
      cleanup(dir);
    }
  });

  it("survives db close/reopen for providers", () => {
    const { dbPath, dir } = tempDbPath();
    try {
      const db1 = new Database(dbPath);
      const reg1 = createSqliteProviderRegistry(db1);
      reg1.create(providerFixture());
      db1.close();

      const db2 = new Database(dbPath);
      const reg2 = createSqliteProviderRegistry(db2);
      const reloaded = reg2.getById("openai-api");
      assert.ok(reloaded);
      assert.equal(reloaded.health.status, "healthy");
      assert.equal(reloaded.apiKeyEnv, "OPENAI_API_KEY");
      db2.close();
    } finally {
      cleanup(dir);
    }
  });

  it("survives db close/reopen for runtimes", () => {
    const { dbPath, dir } = tempDbPath();
    try {
      const db1 = new Database(dbPath);
      const reg1 = createSqliteRuntimeRegistry(db1);
      reg1.create(runtimeFixture());
      db1.close();

      const db2 = new Database(dbPath);
      const reg2 = createSqliteRuntimeRegistry(db2);
      const reloaded = reg2.getById("llama-cpp-local");
      assert.ok(reloaded);
      assert.equal(reloaded.kind, "native-local");
      assert.deepEqual(reloaded.supportedFormats, ["gguf"]);
      db2.close();
    } finally {
      cleanup(dir);
    }
  });

  it("survives db close/reopen for routing rules", () => {
    const { dbPath, dir } = tempDbPath();
    try {
      const db1 = new Database(dbPath);
      const reg1 = createSqliteRoutingRegistry(db1);
      reg1.create(routingRuleFixture());
      db1.close();

      const db2 = new Database(dbPath);
      const reg2 = createSqliteRoutingRegistry(db2);
      const reloaded = reg2.getById("rule-low-latency");
      assert.ok(reloaded);
      assert.equal(reloaded.priority, 10);
      assert.equal(reloaded.enabled, true);
      assert.deepEqual(reloaded.condition, { capability: "reasoning", maxLatencyMs: 500 });
      assert.deepEqual(reloaded.action, { routeTo: "llama-cpp-local", fallback: "cloud-bridge" });
      db2.close();
    } finally {
      cleanup(dir);
    }
  });
});

describe("in-memory registries share deterministic semantics", () => {
  it("model registry behaves consistently", () => {
    const reg = createModelRegistry();
    reg.create(modelFixture());
    assert.throws(() => reg.create(modelFixture()), /Model already exists/);
    assert.equal(reg.getById("nope"), undefined);
    assert.equal(reg.remove("nope"), false);
    assert.equal(reg.update("nope", { name: "x" }), undefined);
  });

  it("provider registry behaves consistently", () => {
    const reg = createProviderRegistry();
    reg.create(providerFixture());
    assert.throws(() => reg.create(providerFixture()), /Provider already exists/);
    assert.equal(reg.getById("nope"), undefined);
    assert.equal(reg.remove("nope"), false);
  });

  it("runtime registry behaves consistently", () => {
    const reg = createRuntimeRegistry();
    reg.create(runtimeFixture());
    assert.throws(() => reg.create(runtimeFixture()), /Runtime already exists/);
    assert.equal(reg.getById("nope"), undefined);
    assert.equal(reg.remove("nope"), false);
    assert.equal(reg.update("nope", { name: "x" }), undefined);
  });

  it("device registry behaves consistently (discovery-only + deterministic misses)", () => {
    const reg = createDeviceRegistry();
    assert.equal(reg.getById("nope"), undefined);
    assert.equal(reg.update("nope", { name: "x" }), undefined);
    const seeded = reg.seed([deviceFixture()]);
    assert.equal(seeded.length, 1);
    assert.equal(reg.getById("dev-mac-m3")?.model, "Apple M3 Max");
    assert.equal(reg.update("dev-mac-m3", { status: "busy" })?.status, "busy");
  });

  it("routing registry behaves consistently", () => {
    const reg = createRoutingRegistry();
    reg.create(routingRuleFixture());
    assert.throws(() => reg.create(routingRuleFixture()), /Routing rule already exists/);
    assert.equal(reg.getById("nope"), undefined);
    assert.equal(reg.remove("nope"), false);
    assert.equal(reg.update("nope", { name: "x" }), undefined);
  });

  it("routing registry sorts deterministically (priority DESC, id ASC)", () => {
    const reg = createRoutingRegistry();
    reg.create(routingRuleFixture({ id: "rule-b", priority: 5 }));
    reg.create(routingRuleFixture({ id: "rule-a", priority: 5 }));
    reg.create(routingRuleFixture({ id: "rule-high", priority: 100 }));
    const ids = reg.list().map((r) => r.id);
    assert.deepEqual(ids, ["rule-high", "rule-a", "rule-b"]);
  });
});

describe("SQLite RuntimeRegistry", () => {
  it("performs full CRUD", () => {
    const db = memoryDb();
    const reg = createSqliteRuntimeRegistry(db);

    assert.equal(reg.list().length, 0);

    const created = reg.create(runtimeFixture());
    assert.ok(created.createdAt.length > 0);
    assert.equal(reg.list().length, 1);

    const fetched = reg.getById("llama-cpp-local");
    assert.ok(fetched);
    assert.equal(fetched.kind, "native-local");
    assert.equal(fetched.maxConcurrent, 4);
    assert.deepEqual(fetched.devices, ["dev-mac-m3"]);
    assert.deepEqual(fetched.config, { threads: 8 });

    const updated = reg.update("llama-cpp-local", { status: "busy", maxConcurrent: 8 });
    assert.ok(updated);
    assert.equal(updated.status, "busy");
    assert.equal(reg.getById("llama-cpp-local")!.maxConcurrent, 8);

    assert.equal(reg.remove("llama-cpp-local"), true);
    assert.equal(reg.list().length, 0);
    db.close();
  });

  it("throws on duplicate id", () => {
    const db = memoryDb();
    const reg = createSqliteRuntimeRegistry(db);
    reg.create(runtimeFixture());
    assert.throws(() => reg.create(runtimeFixture()), /Runtime already exists: llama-cpp-local/);
    db.close();
  });

  it("returns deterministic results for missing ids", () => {
    const db = memoryDb();
    const reg = createSqliteRuntimeRegistry(db);
    assert.equal(reg.getById("nope"), undefined);
    assert.equal(reg.update("nope", { name: "x" }), undefined);
    assert.equal(reg.remove("nope"), false);
    db.close();
  });
});

describe("SQLite DeviceRegistry", () => {
  it("lists empty until seeded — discovery-only, no create/remove", () => {
    const db = memoryDb();
    const reg = createSqliteDeviceRegistry(db);
    assert.equal(reg.list().length, 0);
    assert.equal(reg.getById("dev-mac-m3"), undefined);
    assert.equal(reg.update("dev-mac-m3", { status: "offline" }), undefined);
    db.close();
  });

  it("seed() upserts discovered devices and update() mutates them", () => {
    const db = memoryDb();
    const reg = createSqliteDeviceRegistry(db);

    reg.seed([deviceFixture()]);
    assert.equal(reg.list().length, 1);
    const fetched = reg.getById("dev-mac-m3");
    assert.ok(fetched);
    assert.equal(fetched.kind, "gpu");
    assert.equal(fetched.totalMemoryMb, 131072);
    assert.deepEqual(fetched.runtimeRefs, ["llama-cpp-local"]);

    // re-discovery updates an existing device instead of duplicating
    reg.seed([
      deviceFixture({ usedMemoryMb: 65536, status: "busy" }),
      deviceFixture({
        id: "dev-rtx3090",
        name: "RTX 3090",
        kind: "gpu",
        model: "NVIDIA RTX 3090",
        totalMemoryMb: 24576,
        status: "available",
      }),
    ]);
    assert.equal(reg.list().length, 2);
    assert.equal(reg.getById("dev-mac-m3")!.status, "busy");
    assert.equal(reg.getById("dev-mac-m3")!.usedMemoryMb, 65536);

    const updated = reg.update("dev-rtx3090", { status: "offline" });
    assert.ok(updated);
    assert.equal(reg.getById("dev-rtx3090")!.status, "offline");
    db.close();
  });
});

describe("SQLite RoutingRegistry", () => {
  it("performs full CRUD with condition/action payloads", () => {
    const db = memoryDb();
    const reg = createSqliteRoutingRegistry(db);

    assert.equal(reg.list().length, 0);

    const created = reg.create(routingRuleFixture());
    assert.equal(created.enabled, true);
    assert.equal(reg.list().length, 1);

    const fetched = reg.getById("rule-low-latency");
    assert.ok(fetched);
    assert.equal(fetched.priority, 10);
    assert.equal(fetched.enabled, true);
    assert.deepEqual(fetched.condition, { capability: "reasoning", maxLatencyMs: 500 });
    assert.deepEqual(fetched.action, { routeTo: "llama-cpp-local", fallback: "cloud-bridge" });

    const updated = reg.update("rule-low-latency", { enabled: false, priority: 1 });
    assert.ok(updated);
    assert.equal(updated.enabled, false);
    assert.equal(reg.getById("rule-low-latency")!.priority, 1);
    assert.equal(reg.getById("rule-low-latency")!.condition.maxLatencyMs, 500);

    assert.equal(reg.remove("rule-low-latency"), true);
    assert.equal(reg.list().length, 0);
    db.close();
  });

  it("throws on duplicate id", () => {
    const db = memoryDb();
    const reg = createSqliteRoutingRegistry(db);
    reg.create(routingRuleFixture());
    assert.throws(() => reg.create(routingRuleFixture()), /Routing rule already exists: rule-low-latency/);
    db.close();
  });

  it("returns deterministic results for missing ids", () => {
    const db = memoryDb();
    const reg = createSqliteRoutingRegistry(db);
    assert.equal(reg.getById("nope"), undefined);
    assert.equal(reg.update("nope", { name: "x" }), undefined);
    assert.equal(reg.remove("nope"), false);
    db.close();
  });

  it("orders rules deterministically: priority DESC, then id ASC", () => {
    const db = memoryDb();
    const reg = createSqliteRoutingRegistry(db);
    reg.create(routingRuleFixture({ id: "rule-b", name: "B", priority: 5 }));
    reg.create(routingRuleFixture({ id: "rule-a", name: "A", priority: 5 }));
    reg.create(routingRuleFixture({ id: "rule-high", name: "High", priority: 100 }));
    reg.create(routingRuleFixture({ id: "rule-low", name: "Low", priority: 1 }));

    const ids = reg.list().map((r) => r.id);
    assert.deepEqual(ids, ["rule-high", "rule-a", "rule-b", "rule-low"]);
    db.close();
  });
});

describe("Routing explainer (Phase 6B)", () => {
  const visionInput: RoutingExplainInput = {
    capability: "vision",
    providerKind: "local-proxy",
    latencyMs: 300,
    costPerToken: 0.1,
  };

  function matchAll(overrides: Partial<RoutingRule> = {}): RoutingRule {
    return routingRuleFixture({ condition: {}, ...overrides });
  }

  it("is deterministic: same input → deep-equal output", () => {
    const rules = [
      routingRuleFixture({ id: "rule-b", priority: 5 }),
      routingRuleFixture({ id: "rule-a", priority: 50 }),
    ];
    assert.deepEqual(
      evaluateRoutingRules(rules, visionInput),
      evaluateRoutingRules(rules, visionInput),
    );
  });

  it("wins by priority DESC (higher priority first)", () => {
    const rules = [
      matchAll({ id: "rule-low", priority: 1, action: { routeTo: "low" } }),
      matchAll({ id: "rule-high", priority: 100, action: { routeTo: "high" } }),
    ];
    const res = evaluateRoutingRules(rules, visionInput);
    assert.equal(res.outcome, "matched");
    assert.equal(res.winner!.ruleId, "rule-high");
    assert.equal(res.winner!.routeTo, "high");
    assert.deepEqual(res.rules.map((r) => r.ruleId), ["rule-high", "rule-low"]);
  });

  it("breaks priority ties by id ASC", () => {
    const rules = [
      matchAll({ id: "rule-b", priority: 5, action: { routeTo: "b" } }),
      matchAll({ id: "rule-a", priority: 5, action: { routeTo: "a" } }),
    ];
    const res = evaluateRoutingRules(rules, visionInput);
    assert.equal(res.outcome, "matched");
    assert.equal(res.winner!.ruleId, "rule-a");
    assert.deepEqual(res.rules.map((r) => r.ruleId), ["rule-a", "rule-b"]);
  });

  it("skips disabled rules and reports them as non-eligible", () => {
    const rules = [
      matchAll({ id: "rule-disabled", priority: 100, enabled: false, action: { routeTo: "never" } }),
      matchAll({ id: "rule-enabled", priority: 50, action: { routeTo: "works" } }),
    ];
    const res = evaluateRoutingRules(rules, visionInput);
    assert.equal(res.outcome, "matched");
    assert.equal(res.winner!.ruleId, "rule-enabled");
    const disabled = res.rules.find((r) => r.ruleId === "rule-disabled")!;
    assert.equal(disabled.enabled, false);
    assert.equal(disabled.matched, false);
    assert.equal(disabled.reasons[0].field, "enabled");
    assert.equal(disabled.reasons[0].passed, false);
  });

  it("matches exactly when every condition field passes", () => {
    const rule = routingRuleFixture({
      id: "rule-vision-proxy",
      condition: {
        capability: "vision",
        providerKind: "local-proxy",
        maxLatencyMs: 500,
        maxCostPerToken: 0.2,
      },
      action: { routeTo: "ai-station-proxy", fallback: "cloud-bridge" },
    });
    const res = evaluateRoutingRules([rule], visionInput);
    assert.equal(res.outcome, "matched");
    assert.equal(res.winner!.ruleId, "rule-vision-proxy");
    assert.equal(res.winner!.routeTo, "ai-station-proxy");
    assert.deepEqual(res.rules[0].reasons.map((r) => r.passed), [true, true, true, true]);
  });

  it("reports a partial mismatch with machine-readable reasons", () => {
    const rule = routingRuleFixture({
      id: "rule-vision-proxy",
      condition: { capability: "vision", providerKind: "local-proxy" },
      action: { routeTo: "ai-station-proxy" },
    });
    const res = evaluateRoutingRules([rule], { capability: "text-generation" });
    assert.equal(res.outcome, "no_match");
    assert.equal(res.winner, undefined);
    const reasons = res.rules[0].reasons;
    const capability = reasons.find((r) => r.field === "capability")!;
    assert.equal(capability.passed, false);
    assert.equal(capability.expected, "vision");
    assert.equal(capability.observed, "text-generation");
  });

  it("returns an explicit no-match outcome", () => {
    const rules = [
      routingRuleFixture({ id: "rule-a", condition: { userRole: "admin" }, action: { routeTo: "x" } }),
    ];
    const res = evaluateRoutingRules(rules, { userRole: "guest" });
    assert.equal(res.outcome, "no_match");
    assert.equal(res.winner, undefined);
    assert.equal(res.rules.length, 1);
    assert.equal(res.rules[0].matched, false);
  });

  it("returns fallback and weight as configuration only (no health claims)", () => {
    const rules = [
      matchAll({
        id: "rule-def",
        action: { routeTo: "local", fallback: "cloud", weight: 0.5 },
      }),
    ];
    const res = evaluateRoutingRules(rules, { userRole: "anyone" });
    assert.equal(res.winner!.fallback, "cloud");
    assert.equal(res.winner!.weight, 0.5);
    assert.deepEqual(Object.keys(res.winner!), ["ruleId", "ruleName", "routeTo", "fallback", "weight"]);
  });

  it("treats an enabled rule with empty condition as a catch-all default", () => {
    const res = evaluateRoutingRules([matchAll({ id: "rule-default", action: { routeTo: "default" } })], {});
    assert.equal(res.outcome, "matched");
    assert.equal(res.winner!.ruleId, "rule-default");
  });

  it("enforces latency and cost constraints (observed <= condition max)", () => {
    const rule = routingRuleFixture({
      id: "rule-fast",
      condition: { maxLatencyMs: 500, maxCostPerToken: 0.2 },
      action: { routeTo: "local-fast" },
    });

    const ok = evaluateRoutingRules([rule], { latencyMs: 400, costPerToken: 0.19 });
    assert.equal(ok.outcome, "matched");
    assert.equal(ok.winner!.routeTo, "local-fast");

    const tooSlow = evaluateRoutingRules([rule], { latencyMs: 600 });
    assert.equal(tooSlow.outcome, "no_match");
    const latencyReason = tooSlow.rules[0].reasons.find((r) => r.field === "maxLatencyMs")!;
    assert.equal(latencyReason.passed, false);

    const tooCostly = evaluateRoutingRules([rule], { costPerToken: 0.9 });
    assert.equal(tooCostly.outcome, "no_match");
    const costReason = tooCostly.rules[0].reasons.find((r) => r.field === "maxCostPerToken")!;
    assert.equal(costReason.passed, false);

    const notProvided = evaluateRoutingRules([rule], { capability: "vision" });
    assert.equal(notProvided.outcome, "no_match");
    assert.equal(notProvided.rules[0].reasons.find((r) => r.field === "maxLatencyMs")!.passed, false);
  });

  it("explainer service reads registry in canonical order and never mutates it", () => {
    const reg = createRoutingRegistry();
    reg.create(matchAll({ id: "rule-b", priority: 5, action: { routeTo: "b" } }));
    reg.create(matchAll({ id: "rule-a", priority: 5, action: { routeTo: "a" } }));
    reg.create(matchAll({ id: "rule-top", priority: 50, action: { routeTo: "top" } }));

    const before = reg.list().map((r) => r.id);
    const explainer = createRoutingExplainer(reg);
    const res = explainer.explain({ capability: "reasoning" });

    assert.equal(res.outcome, "matched");
    assert.equal(res.winner!.ruleId, "rule-top");
    assert.deepEqual(res.rules.map((r) => r.ruleId), ["rule-top", "rule-a", "rule-b"]);
    assert.deepEqual(
      reg.list().map((r) => r.id),
      before,
      "explain must not mutate the registry",
    );
  });
});