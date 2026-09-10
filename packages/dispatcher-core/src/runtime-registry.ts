/**
 * @tele-gpt/dispatcher-core — Runtime Registry
 *
 * Two interchangeable implementations of RuntimeRegistry:
 *   - createRuntimeRegistry()          — in-memory (tests, fallback)
 *   - createSqliteRuntimeRegistry(db)  — persistent, shared .data DB
 *
 * Deterministic behavior on both:
 *   - create() with an existing id throws
 *   - getById()/update() with a missing id return undefined
 *   - remove() with a missing id returns false
 */

import type Database from "better-sqlite3";
import { ensureDispatcherSchema } from "./schema.js";
import { isUniqueConstraintError, nowIso, parseJson } from "./sqlite.js";
import type {
  ModelFormat,
  RuntimeConfig,
  RuntimeKind,
  RuntimeRegistry,
  RuntimeStatus,
} from "./types.js";

const RUNTIME_COLUMNS =
  "id, name, kind, status, endpoint, devices_json, supported_formats_json, " +
  "max_concurrent, config_json, created_at";

interface RuntimeRow {
  id: string;
  name: string;
  kind: string;
  status: string;
  endpoint: string | null;
  devices_json: string | null;
  supported_formats_json: string | null;
  max_concurrent: number;
  config_json: string | null;
  created_at: string;
}

const ERROR_DUPLICATE_PREFIX = "Runtime already exists: ";

function inMemoryRuntimeRegistry(): RuntimeRegistry {
  const store = new Map<string, RuntimeConfig>();

  return {
    list() {
      return Array.from(store.values());
    },

    getById(id) {
      return store.get(id);
    },

    create(runtime) {
      const entry: RuntimeConfig = {
        ...runtime,
        devices: runtime.devices ?? [],
        supportedFormats: runtime.supportedFormats ?? [],
        config: runtime.config ?? {},
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
      const updated: RuntimeConfig = { ...existing, ...patch };
      store.set(id, updated);
      return updated;
    },

    remove(id) {
      return store.delete(id);
    },
  };
}

function sqliteRuntimeRegistry(db: Database.Database): RuntimeRegistry {
  ensureDispatcherSchema(db);

  const statement = {
    insert: db.prepare(
      `INSERT INTO dispatcher_runtimes (${RUNTIME_COLUMNS})
       VALUES (@id, @name, @kind, @status, @endpoint, @devicesJson,
               @supportedFormatsJson, @maxConcurrent, @configJson, @createdAt)`,
    ),
    selectAll: db.prepare(
      `SELECT ${RUNTIME_COLUMNS} FROM dispatcher_runtimes ORDER BY name ASC`,
    ),
    selectById: db.prepare(
      `SELECT ${RUNTIME_COLUMNS} FROM dispatcher_runtimes WHERE id = ?`,
    ),
    update: db.prepare(
      `UPDATE dispatcher_runtimes SET
         name = @name, kind = @kind, status = @status, endpoint = @endpoint,
         devices_json = @devicesJson, supported_formats_json = @supportedFormatsJson,
         max_concurrent = @maxConcurrent, config_json = @configJson
       WHERE id = @id`,
    ),
    remove: db.prepare(`DELETE FROM dispatcher_runtimes WHERE id = ?`),
  };

  function toRow(
    runtime: RuntimeConfig,
    includeCreatedAt: boolean,
  ): Record<string, unknown> {
    const row: Record<string, unknown> = {
      id: runtime.id,
      name: runtime.name,
      kind: runtime.kind,
      status: runtime.status,
      endpoint: runtime.endpoint ?? null,
      devicesJson: JSON.stringify(runtime.devices ?? []),
      supportedFormatsJson: JSON.stringify(runtime.supportedFormats ?? []),
      maxConcurrent: runtime.maxConcurrent,
      configJson: JSON.stringify(runtime.config ?? {}),
    };
    if (includeCreatedAt) {
      row.createdAt = runtime.createdAt;
    }
    return row;
  }

  function toRuntime(row: RuntimeRow): RuntimeConfig {
    return {
      id: row.id,
      name: row.name,
      kind: row.kind as RuntimeKind,
      status: row.status as RuntimeStatus,
      endpoint: row.endpoint ?? undefined,
      devices: parseJson<string[]>(row.devices_json, []),
      supportedFormats: parseJson<ModelFormat[]>(row.supported_formats_json, []),
      maxConcurrent: row.max_concurrent,
      config: parseJson<Record<string, unknown>>(row.config_json, {}),
      createdAt: row.created_at,
    };
  }

  function getById(id: string): RuntimeConfig | undefined {
    const row = statement.selectById.get(id) as RuntimeRow | undefined;
    return row ? toRuntime(row) : undefined;
  }

  return {
    list() {
      const rows = statement.selectAll.all() as RuntimeRow[];
      return rows.map(toRuntime);
    },

    getById,

    create(runtime) {
      const entry: RuntimeConfig = {
        ...runtime,
        devices: runtime.devices ?? [],
        supportedFormats: runtime.supportedFormats ?? [],
        config: runtime.config ?? {},
        createdAt: nowIso(),
      };
      try {
        statement.insert.run(toRow(entry, true));
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          throw new Error(ERROR_DUPLICATE_PREFIX + entry.id);
        }
        throw err;
      }
      return entry;
    },

    update(id, patch) {
      const existing = getById(id);
      if (!existing) return undefined;
      const updated: RuntimeConfig = { ...existing, ...patch };
      statement.update.run(toRow(updated, false));
      return updated;
    },

    remove(id) {
      return statement.remove.run(id).changes > 0;
    },
  };
}

export function createRuntimeRegistry(): RuntimeRegistry {
  return inMemoryRuntimeRegistry();
}

export function createSqliteRuntimeRegistry(db: Database.Database): RuntimeRegistry {
  return sqliteRuntimeRegistry(db);
}