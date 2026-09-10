/**
 * Dispatcher API route — thin HTTP layer over @tele-gpt/dispatcher-core.
 *
 * ModelRegistry and ProviderRegistry first; RuntimeRegistry (full CRUD) and
 * DeviceRegistry (read + update only, devices are discovered) added in Phase 5B;
 * RoutingRegistry (full CRUD) added in Phase 6A as control-plane STORAGE ONLY —
 * stored rules never affect real requests; POST /dispatcher/routing/explain
 * added in Phase 6B as a read-only simulation that reports WHO WOULD match.
 * All registry behavior lives in dispatcher-core; these handlers only
 * parse/validate the request envelope and map registry results to
 * deterministic HTTP codes:
 *   200 successful / 201 created / 400 invalid payload
 *   404 missing id / 409 duplicate id / 500 unexpected failure
 *
 * The SQLite connection is injected by the caller (the shared TeleGPT
 * lifecycle via src/core/db.ts) — this route never opens its own connection.
 */

import Database from "better-sqlite3";
import {
  createSqliteDeviceRegistry,
  createSqliteModelRegistry,
  createSqliteProviderRegistry,
  createSqliteRoutingRegistry,
  createSqliteRuntimeRegistry,
} from "@tele-gpt/dispatcher-core";
import { evaluateRoutingRules } from "@tele-gpt/dispatcher-core";
import type {
  Capability,
  Device,
  DeviceRegistry,
  ModelFormat,
  ModelManifest,
  ModelRegistry,
  ProviderConfig,
  ProviderHealth,
  ProviderRegistry,
  RoutingAction,
  RoutingCondition,
  RoutingExplainInput,
  RoutingRegistry,
  RoutingRule,
  RuntimeConfig,
  RuntimeRegistry,
} from "@tele-gpt/dispatcher-core";

const MODEL_FORMATS = new Set([
  "gguf",
  "safetensors",
  "onnx",
  "webgpu",
  "api-only",
  "custom",
]);
const MODEL_STATUSES = new Set([
  "active",
  "disabled",
  "experimental",
  "archived",
]);
const MODEL_SOURCES = new Set(["registry", "foundry", "imported", "builtin"]);
const PROVIDER_KINDS = new Set(["cloud-api", "bridge", "local-proxy", "hybrid"]);
const HEALTH_STATUSES = new Set(["healthy", "degraded", "down", "unknown"]);
const RUNTIME_KINDS = new Set([
  "native-local",
  "browser-webgpu",
  "mobile-ondevice",
  "ai-station",
  "cloud-bridge",
]);
const RUNTIME_STATUSES = new Set([
  "available",
  "busy",
  "stopped",
  "error",
  "provisioning",
]);
const DEVICE_KINDS = new Set([
  "gpu",
  "cpu",
  "npu",
  "tpu",
  "browser",
  "mobile",
  "cluster-node",
]);
const DEVICE_STATUSES = new Set(["available", "busy", "offline", "maintenance"]);
const ROUTING_CAPABILITIES = new Set([
  "reasoning",
  "tools",
  "vision",
  "json",
  "code",
  "long_context",
  "video",
  "audio",
  "image",
  "streaming",
  "function_calling",
]);

interface DispatchRegistries {
  models: ModelRegistry;
  providers: ProviderRegistry;
  runtimes: RuntimeRegistry;
  routing: RoutingRegistry;
  devices: DeviceRegistry;
}

const registriesByDb = new WeakMap<Database.Database, DispatchRegistries>();

function getRegistries(db: Database.Database): DispatchRegistries {
  let registries = registriesByDb.get(db);
  if (!registries) {
    registries = {
      models: createSqliteModelRegistry(db),
      providers: createSqliteProviderRegistry(db),
      runtimes: createSqliteRuntimeRegistry(db),
      routing: createSqliteRoutingRegistry(db),
      devices: createSqliteDeviceRegistry(db),
    };
    registriesByDb.set(db, registries);
  }
  return registries;
}

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

function err(msg: string): ParseResult<never> {
  return { ok: false, error: msg };
}

function isErr<T>(r: ParseResult<T>): r is { ok: false; error: string } {
  return !r.ok;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function validateCapabilities(v: unknown): ParseResult<Capability[]> {
  if (v === undefined) return { ok: true, value: [] };
  if (!isStringArray(v)) return err("capabilities must be an array of strings");
  return { ok: true, value: v as Capability[] };
}

function parseModelBody(body: unknown): ParseResult<Omit<ModelManifest, "createdAt" | "updatedAt">> {
  if (!isRecord(body)) return err("body must be a JSON object");
  const id = parseStr(body.id);
  const name = parseStr(body.name);
  const family = parseStr(body.family);
  const version = parseStr(body.version);
  const format = parseStr(body.format);
  if (!id) return err("field 'id' is required (non-empty string)");
  if (!name) return err("field 'name' is required (non-empty string)");
  if (!family) return err("field 'family' is required (non-empty string)");
  if (!version) return err("field 'version' is required (non-empty string)");
  if (!format) return err("field 'format' is required (non-empty string)");
  if (!MODEL_FORMATS.has(format)) {
    return err(`format must be one of: ${Array.from(MODEL_FORMATS).join(", ")}`);
  }

  const status = parseStr(body.status) ?? "active";
  if (!MODEL_STATUSES.has(status)) {
    return err(`status must be one of: ${Array.from(MODEL_STATUSES).join(", ")}`);
  }
  const source = parseStr(body.source) ?? "registry";
  if (!MODEL_SOURCES.has(source)) {
    return err(`source must be one of: ${Array.from(MODEL_SOURCES).join(", ")}`);
  }
  const capabilities = validateCapabilities(body.capabilities);
  if (isErr(capabilities)) return err(capabilities.error);

  let manifest: ModelManifest["manifest"] = {};
  if (body.manifest !== undefined) {
    if (!isRecord(body.manifest)) return err("manifest must be a JSON object");
    manifest = body.manifest as ModelManifest["manifest"];
  }

  return {
    ok: true,
    value: {
      id,
      name,
      family,
      version,
      format: format as ModelManifest["format"],
      status: status as ModelManifest["status"],
      source: source as ModelManifest["source"],
      capabilities: capabilities.value,
      manifest,
    },
  };
}

function parseProviderBody(body: unknown): ParseResult<Omit<ProviderConfig, "createdAt">> {
  if (!isRecord(body)) return err("body must be a JSON object");
  const id = parseStr(body.id);
  const name = parseStr(body.name);
  const kind = parseStr(body.kind);
  if (!id) return err("field 'id' is required (non-empty string)");
  if (!name) return err("field 'name' is required (non-empty string)");
  if (!kind) return err("field 'kind' is required (non-empty string)");
  if (!PROVIDER_KINDS.has(kind)) {
    return err(`kind must be one of: ${Array.from(PROVIDER_KINDS).join(", ")}`);
  }

  const enabled = body.enabled === undefined ? true : Boolean(body.enabled);

  let priority = 0;
  if (body.priority !== undefined) {
    if (typeof body.priority !== "number" || !Number.isFinite(body.priority) || body.priority < 0) {
      return err("priority must be a non-negative number");
    }
    priority = body.priority;
  }

  const baseUrl = parseStr(body.baseUrl);
  const apiKeyEnv = parseStr(body.apiKeyEnv);

  let runtimeRefs: string[] = [];
  if (body.runtimeRefs !== undefined) {
    if (!isStringArray(body.runtimeRefs)) {
      return err("runtimeRefs must be an array of strings");
    }
    runtimeRefs = body.runtimeRefs;
  }

  let costPerToken: { input: number; output: number } | undefined;
  if (body.costPerToken !== undefined) {
    if (
      !isRecord(body.costPerToken) ||
      typeof body.costPerToken.input !== "number" ||
      typeof body.costPerToken.output !== "number"
    ) {
      return err("costPerToken must be an object with numeric 'input' and 'output'");
    }
    costPerToken = {
      input: body.costPerToken.input,
      output: body.costPerToken.output,
    };
  }

  const capabilities = validateCapabilities(body.capabilities);
  if (isErr(capabilities)) return err(capabilities.error);

  return {
    ok: true,
    value: {
      id,
      name,
      kind: kind as ProviderConfig["kind"],
      enabled,
      priority,
      baseUrl,
      apiKeyEnv,
      runtimeRefs,
      costPerToken,
      capabilities: capabilities.value,
      health: {
        status: "unknown",
        lastCheck: new Date().toISOString(),
        successCount: 0,
        failCount: 0,
      },
    },
  };
}

function parseHealthBody(body: unknown): ParseResult<ProviderHealth> {
  if (!isRecord(body)) return err("body must be a JSON object");
  const status = parseStr(body.status) ?? "unknown";
  if (!HEALTH_STATUSES.has(status)) {
    return err(`status must be one of: ${Array.from(HEALTH_STATUSES).join(", ")}`);
  }
  const latencyMs =
    body.latencyMs === undefined || body.latencyMs === null
      ? undefined
      : body.latencyMs;
  if (latencyMs !== undefined && (typeof latencyMs !== "number" || latencyMs < 0)) {
    return err("latencyMs must be a non-negative number");
  }
  const errorRate =
    body.errorRate === undefined || body.errorRate === null ? undefined : body.errorRate;
  if (errorRate !== undefined && (typeof errorRate !== "number" || errorRate < 0 || errorRate > 1)) {
    return err("errorRate must be a number between 0 and 1");
  }
  const successCount = body.successCount === undefined ? 0 : body.successCount;
  if (typeof successCount !== "number" || !Number.isInteger(successCount) || successCount < 0) {
    return err("successCount must be a non-negative integer");
  }
  const failCount = body.failCount === undefined ? 0 : body.failCount;
  if (typeof failCount !== "number" || !Number.isInteger(failCount) || failCount < 0) {
    return err("failCount must be a non-negative integer");
  }
  return {
    ok: true,
    value: {
      status: status as ProviderHealth["status"],
      lastCheck: new Date().toISOString(),
      latencyMs: latencyMs as number | undefined,
      errorRate: errorRate as number | undefined,
      successCount,
      failCount,
    },
  };
}

function parseRuntimeBody(body: unknown): ParseResult<Omit<RuntimeConfig, "createdAt">> {
  if (!isRecord(body)) return err("body must be a JSON object");
  const id = parseStr(body.id);
  const name = parseStr(body.name);
  const kind = parseStr(body.kind);
  if (!id) return err("field 'id' is required (non-empty string)");
  if (!name) return err("field 'name' is required (non-empty string)");
  if (!kind) return err("field 'kind' is required (non-empty string)");
  if (!RUNTIME_KINDS.has(kind)) {
    return err(`kind must be one of: ${Array.from(RUNTIME_KINDS).join(", ")}`);
  }

  const status = parseStr(body.status) ?? "available";
  if (!RUNTIME_STATUSES.has(status)) {
    return err(`status must be one of: ${Array.from(RUNTIME_STATUSES).join(", ")}`);
  }

  const endpoint = parseStr(body.endpoint);

  let devices: string[] = [];
  if (body.devices !== undefined) {
    if (!isStringArray(body.devices)) {
      return err("devices must be an array of strings");
    }
    devices = body.devices;
  }

  let supportedFormats: ModelFormat[] = [];
  if (body.supportedFormats !== undefined) {
    if (!isStringArray(body.supportedFormats)) {
      return err("supportedFormats must be an array of strings");
    }
    for (const f of body.supportedFormats) {
      if (!MODEL_FORMATS.has(f)) {
        return err(`supportedFormats must be one of: ${Array.from(MODEL_FORMATS).join(", ")}`);
      }
    }
    supportedFormats = body.supportedFormats as ModelFormat[];
  }

  let maxConcurrent = 1;
  if (body.maxConcurrent !== undefined) {
    if (typeof body.maxConcurrent !== "number" || !Number.isInteger(body.maxConcurrent) || body.maxConcurrent < 1) {
      return err("maxConcurrent must be a positive integer");
    }
    maxConcurrent = body.maxConcurrent;
  }

  let config: Record<string, unknown> = {};
  if (body.config !== undefined) {
    if (!isRecord(body.config)) return err("config must be a JSON object");
    config = body.config as Record<string, unknown>;
  }

  return {
    ok: true,
    value: {
      id,
      name,
      kind: kind as RuntimeConfig["kind"],
      status: status as RuntimeConfig["status"],
      endpoint,
      devices,
      supportedFormats,
      maxConcurrent,
      config,
    },
  };
}

function parseCondition(v: Record<string, unknown>): ParseResult<RoutingCondition> {
  const condition: RoutingCondition = {};

  const capability = parseStr(v.capability);
  if (capability !== undefined) {
    if (!ROUTING_CAPABILITIES.has(capability)) {
      return err(`condition.capability must be one of: ${Array.from(ROUTING_CAPABILITIES).join(", ")}`);
    }
    condition.capability = capability as Capability;
  }

  const modelFamily = parseStr(v.modelFamily);
  if (modelFamily !== undefined) condition.modelFamily = modelFamily;

  const runtimeKind = parseStr(v.runtimeKind);
  if (runtimeKind !== undefined) {
    if (!RUNTIME_KINDS.has(runtimeKind)) {
      return err(`condition.runtimeKind must be one of: ${Array.from(RUNTIME_KINDS).join(", ")}`);
    }
    condition.runtimeKind = runtimeKind as RuntimeConfig["kind"];
  }

  const providerKind = parseStr(v.providerKind);
  if (providerKind !== undefined) {
    if (!PROVIDER_KINDS.has(providerKind)) {
      return err(`condition.providerKind must be one of: ${Array.from(PROVIDER_KINDS).join(", ")}`);
    }
    condition.providerKind = providerKind as ProviderConfig["kind"];
  }

  for (const key of ["maxLatencyMs", "maxCostPerToken"] as const) {
    if (v[key] !== undefined) {
      if (typeof v[key] !== "number" || !Number.isFinite(v[key]) || (v[key] as number) < 0) {
        return err(`condition.${key} must be a non-negative number`);
      }
      condition[key] = v[key] as number;
    }
  }

  const userRole = parseStr(v.userRole);
  if (userRole !== undefined) condition.userRole = userRole;

  return { ok: true, value: condition };
}

function parseAction(v: Record<string, unknown>): ParseResult<RoutingAction> {
  const routeTo = parseStr(v.routeTo);
  if (!routeTo) return err("field 'action.routeTo' is required (non-empty string)");

  const fallback = parseStr(v.fallback);

  let weight: number | undefined;
  if (v.weight !== undefined) {
    if (typeof v.weight !== "number" || !Number.isFinite(v.weight) || v.weight < 0) {
      return err("action.weight must be a non-negative number");
    }
    weight = v.weight;
  }

  return { ok: true, value: { routeTo, fallback, weight } };
}

function parseRoutingBody(body: unknown): ParseResult<RoutingRule> {
  if (!isRecord(body)) return err("body must be a JSON object");
  const id = parseStr(body.id);
  const name = parseStr(body.name);
  if (!id) return err("field 'id' is required (non-empty string)");
  if (!name) return err("field 'name' is required (non-empty string)");

  let priority = 0;
  if (body.priority !== undefined) {
    if (typeof body.priority !== "number" || !Number.isFinite(body.priority) || body.priority < 0) {
      return err("priority must be a non-negative number");
    }
    priority = body.priority;
  }

  const enabled = body.enabled === undefined ? true : Boolean(body.enabled);

  let condition: RoutingCondition = {};
  if (body.condition !== undefined) {
    if (!isRecord(body.condition)) return err("condition must be a JSON object");
    const parsed = parseCondition(body.condition);
    if (isErr(parsed)) return err(parsed.error);
    condition = parsed.value;
  }

  if (!isRecord(body.action)) {
    return err("field 'action' is required (must be a JSON object with a non-empty 'routeTo')");
  }
  const action = parseAction(body.action);
  if (isErr(action)) return err(action.error);

  return { ok: true, value: { id, name, priority, enabled, condition, action: action.value } };
}

function parseExplainInput(body: unknown): ParseResult<RoutingExplainInput> {
  if (body === undefined || body === null) return { ok: true, value: {} };
  if (!isRecord(body)) return err("body must be a JSON object");

  const input: RoutingExplainInput = {};

  if (body.capability !== undefined) {
    const capability = parseStr(body.capability);
    if (capability === undefined || !ROUTING_CAPABILITIES.has(capability)) {
      return err(`capability must be one of: ${Array.from(ROUTING_CAPABILITIES).join(", ")}`);
    }
    input.capability = capability as Capability;
  }

  if (body.modelFamily !== undefined) {
    const modelFamily = parseStr(body.modelFamily);
    if (modelFamily === undefined) return err("modelFamily must be a non-empty string");
    input.modelFamily = modelFamily;
  }

  if (body.runtimeKind !== undefined) {
    const runtimeKind = parseStr(body.runtimeKind);
    if (runtimeKind === undefined || !RUNTIME_KINDS.has(runtimeKind)) {
      return err(`runtimeKind must be one of: ${Array.from(RUNTIME_KINDS).join(", ")}`);
    }
    input.runtimeKind = runtimeKind as RuntimeConfig["kind"];
  }

  if (body.providerKind !== undefined) {
    const providerKind = parseStr(body.providerKind);
    if (providerKind === undefined || !PROVIDER_KINDS.has(providerKind)) {
      return err(`providerKind must be one of: ${Array.from(PROVIDER_KINDS).join(", ")}`);
    }
    input.providerKind = providerKind as ProviderConfig["kind"];
  }

  for (const key of ["latencyMs", "costPerToken"] as const) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== "number" || !Number.isFinite(body[key]) || (body[key] as number) < 0) {
        return err(`${key} must be a non-negative number`);
      }
      input[key] = body[key] as number;
    }
  }

  if (body.userRole !== undefined) {
    const userRole = parseStr(body.userRole);
    if (userRole === undefined) return err("userRole must be a non-empty string");
    input.userRole = userRole;
  }

  return { ok: true, value: input };
}

export async function registerDispatcherRoute(server: any, db: Database.Database) {
  const { models, providers, runtimes, routing, devices } = getRegistries(db);

  // ── Models ──────────────────────────────────────────────
  server.get("/dispatcher/models", async (_req: any, reply: any) => {
    try {
      return reply.send({ items: models.list() });
    } catch (e: any) {
      return reply.status(500).send({ error: "internal", message: messageOf(e) });
    }
  });

  server.get("/dispatcher/models/:id", async (req: any, reply: any) => {
    try {
      const item = models.getById(req.params.id);
      if (!item) return notFound(reply, "model", req.params.id);
      return reply.send(item);
    } catch (e: any) {
      return reply.status(500).send({ error: "internal", message: messageOf(e) });
    }
  });

  server.post("/dispatcher/models", async (req: any, reply: any) => {
    try {
      const parsed = parseModelBody(req.body);
      if (isErr(parsed)) return reply.status(400).send({ error: "invalid_payload", message: parsed.error });
      const created = models.create(parsed.value);
      return reply.status(201).send(created);
    } catch (e: any) {
      return duplicateOrInternal(reply, e, { re: /Model already exists/, id: (req.body as any)?.id });
    }
  });

  server.put("/dispatcher/models/:id", async (req: any, reply: any) => {
    try {
      const item = models.getById(req.params.id);
      if (!item) return notFound(reply, "model", req.params.id);
      const body = isRecord(req.body) ? req.body : {};
      const updated = models.update(req.params.id, body as Partial<ModelManifest>);
      return reply.send(updated);
    } catch (e: any) {
      return reply.status(500).send({ error: "internal", message: messageOf(e) });
    }
  });

  server.delete("/dispatcher/models/:id", async (req: any, reply: any) => {
    try {
      const removed = models.remove(req.params.id);
      if (!removed) return notFound(reply, "model", req.params.id);
      return reply.send({ removed: true, id: req.params.id });
    } catch (e: any) {
      return reply.status(500).send({ error: "internal", message: messageOf(e) });
    }
  });

  // ── Providers ───────────────────────────────────────────
  server.get("/dispatcher/providers", async (_req: any, reply: any) => {
    try {
      return reply.send({ items: providers.list() });
    } catch (e: any) {
      return reply.status(500).send({ error: "internal", message: messageOf(e) });
    }
  });

  server.get("/dispatcher/providers/:id", async (req: any, reply: any) => {
    try {
      const item = providers.getById(req.params.id);
      if (!item) return notFound(reply, "provider", req.params.id);
      return reply.send(item);
    } catch (e: any) {
      return reply.status(500).send({ error: "internal", message: messageOf(e) });
    }
  });

  server.post("/dispatcher/providers", async (req: any, reply: any) => {
    try {
      const parsed = parseProviderBody(req.body);
      if (isErr(parsed)) return reply.status(400).send({ error: "invalid_payload", message: parsed.error });
      const created = providers.create(parsed.value);
      return reply.status(201).send(created);
    } catch (e: any) {
      return duplicateOrInternal(reply, e, { re: /Provider already exists/, id: (req.body as any)?.id });
    }
  });

  server.put("/dispatcher/providers/:id", async (req: any, reply: any) => {
    try {
      const item = providers.getById(req.params.id);
      if (!item) return notFound(reply, "provider", req.params.id);
      const body = isRecord(req.body) ? req.body : {};
      const updated = providers.update(req.params.id, body as Partial<ProviderConfig>);
      return reply.send(updated);
    } catch (e: any) {
      return reply.status(500).send({ error: "internal", message: messageOf(e) });
    }
  });

  server.delete("/dispatcher/providers/:id", async (req: any, reply: any) => {
    try {
      const removed = providers.remove(req.params.id);
      if (!removed) return notFound(reply, "provider", req.params.id);
      return reply.send({ removed: true, id: req.params.id });
    } catch (e: any) {
      return reply.status(500).send({ error: "internal", message: messageOf(e) });
    }
  });

  server.post("/dispatcher/providers/:id/health", async (req: any, reply: any) => {
    try {
      const item = providers.getById(req.params.id);
      if (!item) return notFound(reply, "provider", req.params.id);
      const parsed = parseHealthBody(req.body);
      if (isErr(parsed)) return reply.status(400).send({ error: "invalid_payload", message: parsed.error });
      const updated = providers.updateHealth(req.params.id, parsed.value);
      return reply.send(updated);
    } catch (e: any) {
      return reply.status(500).send({ error: "internal", message: messageOf(e) });
    }
  });

  // ── Runtimes ───────────────────────────────────────────
  server.get("/dispatcher/runtimes", async (_req: any, reply: any) => {
    try {
      return reply.send({ items: runtimes.list() });
    } catch (e: any) {
      return reply.status(500).send({ error: "internal", message: messageOf(e) });
    }
  });

  server.get("/dispatcher/runtimes/:id", async (req: any, reply: any) => {
    try {
      const item = runtimes.getById(req.params.id);
      if (!item) return notFound(reply, "runtime", req.params.id);
      return reply.send(item);
    } catch (e: any) {
      return reply.status(500).send({ error: "internal", message: messageOf(e) });
    }
  });

  server.post("/dispatcher/runtimes", async (req: any, reply: any) => {
    try {
      const parsed = parseRuntimeBody(req.body);
      if (isErr(parsed)) return reply.status(400).send({ error: "invalid_payload", message: parsed.error });
      const created = runtimes.create(parsed.value);
      return reply.status(201).send(created);
    } catch (e: any) {
      return duplicateOrInternal(reply, e, { re: /Runtime already exists/, id: (req.body as any)?.id });
    }
  });

  server.put("/dispatcher/runtimes/:id", async (req: any, reply: any) => {
    try {
      const item = runtimes.getById(req.params.id);
      if (!item) return notFound(reply, "runtime", req.params.id);
      const body = isRecord(req.body) ? req.body : {};
      const updated = runtimes.update(req.params.id, body as Partial<RuntimeConfig>);
      return reply.send(updated);
    } catch (e: any) {
      return reply.status(500).send({ error: "internal", message: messageOf(e) });
    }
  });

  server.delete("/dispatcher/runtimes/:id", async (req: any, reply: any) => {
    try {
      const removed = runtimes.remove(req.params.id);
      if (!removed) return notFound(reply, "runtime", req.params.id);
      return reply.send({ removed: true, id: req.params.id });
    } catch (e: any) {
      return reply.status(500).send({ error: "internal", message: messageOf(e) });
    }
  });

  // ── Routing rules (control-plane storage only — never applied to real traffic in 6A)
  server.get("/dispatcher/routing", async (_req: any, reply: any) => {
    try {
      return reply.send({ items: routing.list() });
    } catch (e: any) {
      return reply.status(500).send({ error: "internal", message: messageOf(e) });
    }
  });

  // Read-only simulation (Phase 6B): evaluates WHO WOULD match, never executes
  // or mutates anything, never asserts target health/availability.
  server.post("/dispatcher/routing/explain", async (req: any, reply: any) => {
    try {
      const parsed = parseExplainInput(req.body);
      if (isErr(parsed)) return reply.status(400).send({ error: "invalid_payload", message: parsed.error });
      const result = evaluateRoutingRules(routing.list(), parsed.value);
      return reply.send(result);
    } catch (e: any) {
      return reply.status(500).send({ error: "internal", message: messageOf(e) });
    }
  });

  server.get("/dispatcher/routing/:id", async (req: any, reply: any) => {
    try {
      const item = routing.getById(req.params.id);
      if (!item) return notFound(reply, "routing rule", req.params.id);
      return reply.send(item);
    } catch (e: any) {
      return reply.status(500).send({ error: "internal", message: messageOf(e) });
    }
  });

  server.post("/dispatcher/routing", async (req: any, reply: any) => {
    try {
      const parsed = parseRoutingBody(req.body);
      if (isErr(parsed)) return reply.status(400).send({ error: "invalid_payload", message: parsed.error });
      const created = routing.create(parsed.value);
      return reply.status(201).send(created);
    } catch (e: any) {
      return duplicateOrInternal(reply, e, { re: /Routing rule already exists/, id: (req.body as any)?.id });
    }
  });

  server.put("/dispatcher/routing/:id", async (req: any, reply: any) => {
    try {
      const item = routing.getById(req.params.id);
      if (!item) return notFound(reply, "routing rule", req.params.id);
      const body = isRecord(req.body) ? req.body : {};
      const updated = routing.update(req.params.id, body as Partial<RoutingRule>);
      return reply.send(updated);
    } catch (e: any) {
      return reply.status(500).send({ error: "internal", message: messageOf(e) });
    }
  });

  server.delete("/dispatcher/routing/:id", async (req: any, reply: any) => {
    try {
      const removed = routing.remove(req.params.id);
      if (!removed) return notFound(reply, "routing rule", req.params.id);
      return reply.send({ removed: true, id: req.params.id });
    } catch (e: any) {
      return reply.status(500).send({ error: "internal", message: messageOf(e) });
    }
  });

  // ── Devices (read + update only — devices are discovered, not user-created)
  server.get("/dispatcher/devices", async (_req: any, reply: any) => {
    try {
      return reply.send({ items: devices.list() });
    } catch (e: any) {
      return reply.status(500).send({ error: "internal", message: messageOf(e) });
    }
  });

  server.get("/dispatcher/devices/:id", async (req: any, reply: any) => {
    try {
      const item = devices.getById(req.params.id);
      if (!item) return notFound(reply, "device", req.params.id);
      return reply.send(item);
    } catch (e: any) {
      return reply.status(500).send({ error: "internal", message: messageOf(e) });
    }
  });

  server.put("/dispatcher/devices/:id", async (req: any, reply: any) => {
    try {
      const item = devices.getById(req.params.id);
      if (!item) return notFound(reply, "device", req.params.id);
      const body = isRecord(req.body) ? req.body : {};
      const updated = devices.update(req.params.id, body as Partial<Device>);
      return reply.send(updated);
    } catch (e: any) {
      return reply.status(500).send({ error: "internal", message: messageOf(e) });
    }
  });
}

function notFound(reply: any, kind: string, id: string) {
  return reply
    .status(404)
    .send({ error: "not_found", message: `${kind} not found`, id });
}

function messageOf(e: any): string {
  return typeof e?.message === "string" && e.message.length ? e.message : "unknown error";
}

function duplicateOrInternal(reply: any, e: any, opts: { re: RegExp; id: unknown }) {
  const msg = messageOf(e);
  if (opts.re.test(msg)) {
    return reply.status(409).send({ error: "duplicate", message: msg, id: opts.id });
  }
  return reply.status(500).send({ error: "internal", message: msg });
}