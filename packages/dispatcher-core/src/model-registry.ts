/**
 * @tele-gpt/dispatcher-core — Model Registry
 *
 * Two interchangeable implementations of ModelRegistry:
 *   - createModelRegistry()             — in-memory (tests, fallback)
 *   - createSqliteModelRegistry(db)     — persistent, shared .data DB
 *
 * Deterministic behavior on both:
 *   - create() with an existing id throws
 *   - getById()/update() with a missing id return undefined
 *   - remove() with a missing id returns false
 */

import type Database from "better-sqlite3";
import { ensureDispatcherSchema } from "./schema.js";
import { isUniqueConstraintError, nextIso, nowIso, parseJson } from "./sqlite.js";
import type {
  Capability,
  ModelFormat,
  ModelManifest,
  ModelManifestMeta,
  ModelRegistry,
  ModelSource,
  ModelStatus,
} from "./types.js";

const MODEL_COLUMNS =
  "id, name, family, version, format, status, source, capabilities_json, manifest_json, created_at, updated_at";

interface ModelRow {
  id: string;
  name: string;
  family: string;
  version: string;
  format: string;
  status: string;
  source: string;
  capabilities_json: string;
  manifest_json: string;
  created_at: string;
  updated_at: string;
}

function createInMemoryModelRegistry(): ModelRegistry {
  const store = new Map<string, ModelManifest>();

  return {
    list() {
      return Array.from(store.values());
    },

    getById(id) {
      return store.get(id);
    },

    create(model) {
      const entry: ModelManifest = {
        ...model,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      if (store.has(entry.id)) {
        throw new Error(`Model already exists: ${entry.id}`);
      }
      store.set(entry.id, entry);
      return entry;
    },

    update(id, patch) {
      const existing = store.get(id);
      if (!existing) return undefined;
      const updated: ModelManifest = {
        ...existing,
        ...patch,
        updatedAt: nextIso(existing.updatedAt),
      };
      store.set(id, updated);
      return updated;
    },

    remove(id) {
      return store.delete(id);
    },
  };
}

export function createModelRegistry(): ModelRegistry {
  return createInMemoryModelRegistry();
}

export function createSqliteModelRegistry(db: Database.Database): ModelRegistry {
  ensureDispatcherSchema(db);

  const statement = {
    insert: db.prepare(
      `INSERT INTO dispatcher_models (${MODEL_COLUMNS})
       VALUES (@id, @name, @family, @version, @format, @status, @source,
               @capabilitiesJson, @manifestJson, @createdAt, @updatedAt)`,
    ),
    selectAll: db.prepare(
      `SELECT ${MODEL_COLUMNS} FROM dispatcher_models ORDER BY family ASC, name ASC`,
    ),
    selectById: db.prepare(
      `SELECT ${MODEL_COLUMNS} FROM dispatcher_models WHERE id = ?`,
    ),
    update: db.prepare(
      `UPDATE dispatcher_models SET
         name = @name, family = @family, version = @version, format = @format,
         status = @status, source = @source,
         capabilities_json = @capabilitiesJson, manifest_json = @manifestJson,
         updated_at = @updatedAt
       WHERE id = @id`,
    ),
    remove: db.prepare(`DELETE FROM dispatcher_models WHERE id = ?`),
  };

  function toRow(model: ModelManifest): Record<string, unknown> {
    return {
      id: model.id,
      name: model.name,
      family: model.family,
      version: model.version,
      format: model.format,
      status: model.status,
      source: model.source,
      capabilitiesJson: JSON.stringify(model.capabilities ?? []),
      manifestJson: JSON.stringify(model.manifest ?? {}),
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }

  function toModel(row: ModelRow): ModelManifest {
    return {
      id: row.id,
      name: row.name,
      family: row.family,
      version: row.version,
      format: row.format as ModelFormat,
      status: row.status as ModelStatus,
      source: row.source as ModelSource,
      capabilities: parseJson<Capability[]>(row.capabilities_json, []),
      manifest: parseJson<ModelManifestMeta>(row.manifest_json, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function getById(id: string): ModelManifest | undefined {
    const row = statement.selectById.get(id) as ModelRow | undefined;
    return row ? toModel(row) : undefined;
  }

  return {
    list() {
      const rows = statement.selectAll.all() as ModelRow[];
      return rows.map(toModel);
    },

    getById,

    create(model) {
      const entry: ModelManifest = {
        ...model,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      try {
        statement.insert.run(toRow(entry));
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          throw new Error(`Model already exists: ${entry.id}`);
        }
        throw err;
      }
      return entry;
    },

    update(id, patch) {
      const existing = getById(id);
      if (!existing) return undefined;
      const updated: ModelManifest = {
        ...existing,
        ...patch,
        updatedAt: nextIso(existing.updatedAt),
      };
      statement.update.run(toRow(updated));
      return updated;
    },

    remove(id) {
      return statement.remove.run(id).changes > 0;
    },
  };
}