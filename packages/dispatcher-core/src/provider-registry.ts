/**
 * @tele-gpt/dispatcher-core — Provider Registry
 *
 * Two interchangeable implementations of ProviderRegistry:
 *   - createProviderRegistry()          — in-memory (tests, fallback)
 *   - createSqliteProviderRegistry(db)  — persistent, shared .data DB
 *
 * Deterministic behavior on both:
 *   - create() with an existing id throws
 *   - getById()/update()/updateHealth() with a missing id return undefined
 *   - remove() with a missing id returns false
 *
 * Only env var references (apiKeyEnv) are stored — never raw API keys.
 */

import type Database from "better-sqlite3";
import { ensureDispatcherSchema } from "./schema.js";
import { isUniqueConstraintError, nowIso, parseJson } from "./sqlite.js";
import type {
  Capability,
  ProviderConfig,
  ProviderHealth,
  ProviderKind,
  ProviderRegistry,
} from "./types.js";

const PROVIDER_COLUMNS =
  "id, name, kind, enabled, priority, base_url, api_key_env, " +
  "health_status, health_last_check, health_latency_ms, health_error_rate, " +
  "health_success_count, health_fail_count, " +
  "runtime_refs_json, cost_per_token_json, capabilities_json, created_at";

interface ProviderRow {
  id: string;
  name: string;
  kind: string;
  enabled: number;
  priority: number;
  base_url: string | null;
  api_key_env: string | null;
  health_status: string | null;
  health_last_check: string | null;
  health_latency_ms: number | null;
  health_error_rate: number | null;
  health_success_count: number | null;
  health_fail_count: number | null;
  runtime_refs_json: string | null;
  cost_per_token_json: string | null;
  capabilities_json: string | null;
  created_at: string;
}

function defaultHealth(): ProviderHealth {
  return {
    status: "unknown",
    lastCheck: nowIso(),
    successCount: 0,
    failCount: 0,
  };
}

const ERROR_DUPLICATE_PREFIX = "Provider already exists: ";

function inMemoryProviderRegistry(): ProviderRegistry {
  const store = new Map<string, ProviderConfig>();

  return {
    list() {
      return Array.from(store.values());
    },

    getById(id) {
      return store.get(id);
    },

    create(provider) {
      const entry: ProviderConfig = {
        ...provider,
        health: provider.health ?? defaultHealth(),
        createdAt: nowIso(),
      };
      if (store.has(entry.id)) {
        throw new Error(ERROR_DUPLICATE_PREFIX + entry.id);
      }
      store.set(entry.id, entry);
      return entry;
    },

    update(id, patch) {
      const existing = store.get(id);
      if (!existing) return undefined;
      const updated: ProviderConfig = { ...existing, ...patch };
      store.set(id, updated);
      return updated;
    },

    remove(id) {
      return store.delete(id);
    },

    updateHealth(id, health: ProviderHealth) {
      const existing = store.get(id);
      if (!existing) return undefined;
      const updated: ProviderConfig = { ...existing, health };
      store.set(id, updated);
      return updated;
    },
  };
}

function sqliteProviderRegistry(db: Database.Database): ProviderRegistry {
  ensureDispatcherSchema(db);

  const statement = {
    insert: db.prepare(
      `INSERT INTO dispatcher_providers (${PROVIDER_COLUMNS})
       VALUES (@id, @name, @kind, @enabled, @priority, @baseUrl, @apiKeyEnv,
               @healthStatus, @healthLastCheck, @healthLatencyMs, @healthErrorRate,
               @healthSuccessCount, @healthFailCount,
               @runtimeRefsJson, @costPerTokenJson, @capabilitiesJson, @createdAt)`,
    ),
    selectAll: db.prepare(
      `SELECT ${PROVIDER_COLUMNS} FROM dispatcher_providers ORDER BY priority ASC, name ASC`,
    ),
    selectById: db.prepare(
      `SELECT ${PROVIDER_COLUMNS} FROM dispatcher_providers WHERE id = ?`,
    ),
    update: db.prepare(
      `UPDATE dispatcher_providers SET
         name = @name, kind = @kind, enabled = @enabled, priority = @priority,
         base_url = @baseUrl, api_key_env = @apiKeyEnv,
         health_status = @healthStatus, health_last_check = @healthLastCheck,
         health_latency_ms = @healthLatencyMs, health_error_rate = @healthErrorRate,
         health_success_count = @healthSuccessCount, health_fail_count = @healthFailCount,
         runtime_refs_json = @runtimeRefsJson, cost_per_token_json = @costPerTokenJson,
         capabilities_json = @capabilitiesJson
       WHERE id = @id`,
    ),
    remove: db.prepare(`DELETE FROM dispatcher_providers WHERE id = ?`),
  };

  function toRow(
    provider: ProviderConfig,
    includeCreatedAt: boolean,
  ): Record<string, unknown> {
    const health = provider.health ?? defaultHealth();
    const row: Record<string, unknown> = {
      id: provider.id,
      name: provider.name,
      kind: provider.kind,
      enabled: provider.enabled ? 1 : 0,
      priority: provider.priority,
      baseUrl: provider.baseUrl ?? null,
      apiKeyEnv: provider.apiKeyEnv ?? null,
      healthStatus: health.status,
      healthLastCheck: health.lastCheck,
      healthLatencyMs: health.latencyMs ?? null,
      healthErrorRate: health.errorRate ?? null,
      healthSuccessCount: health.successCount,
      healthFailCount: health.failCount,
      runtimeRefsJson: JSON.stringify(provider.runtimeRefs ?? []),
      costPerTokenJson: provider.costPerToken
        ? JSON.stringify(provider.costPerToken)
        : null,
      capabilitiesJson: JSON.stringify(provider.capabilities ?? []),
    };
    if (includeCreatedAt) {
      row.createdAt = provider.createdAt;
    }
    return row;
  }

  function toProvider(row: ProviderRow): ProviderConfig {
    const health: ProviderHealth = {
      status: (row.health_status ?? "unknown") as ProviderHealth["status"],
      lastCheck: row.health_last_check ?? "",
      latencyMs: row.health_latency_ms ?? undefined,
      errorRate: row.health_error_rate ?? undefined,
      successCount: row.health_success_count ?? 0,
      failCount: row.health_fail_count ?? 0,
    };
    return {
      id: row.id,
      name: row.name,
      kind: row.kind as ProviderKind,
      enabled: row.enabled === 1,
      priority: row.priority,
      health,
      baseUrl: row.base_url ?? undefined,
      apiKeyEnv: row.api_key_env ?? undefined,
      runtimeRefs: parseJson<string[]>(row.runtime_refs_json, []),
      costPerToken: row.cost_per_token_json
        ? parseJson<{ input: number; output: number }>(
            row.cost_per_token_json,
            { input: 0, output: 0 },
          )
        : undefined,
      capabilities: parseJson<Capability[]>(row.capabilities_json, []),
      createdAt: row.created_at,
    };
  }

  function getById(id: string): ProviderConfig | undefined {
    const row = statement.selectById.get(id) as ProviderRow | undefined;
    return row ? toProvider(row) : undefined;
  }

  function buildDuplicateError(id: string): Error {
    return new Error(ERROR_DUPLICATE_PREFIX + id);
  }

  return {
    list() {
      const rows = statement.selectAll.all() as ProviderRow[];
      return rows.map(toProvider);
    },

    getById,

    create(provider) {
      const entry: ProviderConfig = {
        ...provider,
        health: provider.health ?? defaultHealth(),
        createdAt: nowIso(),
      };
      try {
        statement.insert.run(toRow(entry, true));
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          throw buildDuplicateError(entry.id);
        }
        throw err;
      }
      return entry;
    },

    update(id, patch) {
      const existing = getById(id);
      if (!existing) return undefined;
      const updated: ProviderConfig = { ...existing, ...patch };
      statement.update.run(toRow(updated, false));
      return updated;
    },

    remove(id) {
      return statement.remove.run(id).changes > 0;
    },

    updateHealth(id, health: ProviderHealth) {
      const existing = getById(id);
      if (!existing) return undefined;
      const updated: ProviderConfig = { ...existing, health };
      statement.update.run(toRow(updated, false));
      return updated;
    },
  };
}

export function createProviderRegistry(): ProviderRegistry {
  return inMemoryProviderRegistry();
}

export function createSqliteProviderRegistry(db: Database.Database): ProviderRegistry {
  return sqliteProviderRegistry(db);
}