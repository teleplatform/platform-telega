/**
 * @tele-gpt/dispatcher-core — Device Registry
 *
 * Two interchangeable implementations of the DeviceRegistry:
 *   - createDeviceRegistry()          — in-memory (tests, fallback)
 *   - createSqliteDeviceRegistry(db)  — persistent, shared .data DB
 *
 * Per the DeviceRegistry contract, devices are *discovered*, not user-created:
 * the interface exposes only list()/getById()/update(). There is deliberately
 * no create()/remove() on the API — a device appears when a discovery/probe
 * component (future phase) reports it.
 *
 * To make that possible without widening the public interface, the concrete
 * registry also exposes an internal `seed()` upsert (idempotent INSERT...
 * ON CONFLICT DO UPDATE). It is NOT part of DeviceRegistry and is never
 * exposed over HTTP — it is the write path for runtime discovery.
 *
 * Deterministic behavior on both implementations:
 *   - getById()/update() with a missing id return undefined
 */

import type Database from "better-sqlite3";
import { ensureDispatcherSchema } from "./schema.js";
import { parseJson } from "./sqlite.js";
import type {
  Device,
  DeviceKind,
  DeviceRegistry,
  DeviceStatus,
} from "./types.js";

const DEVICE_COLUMNS =
  "id, name, kind, model, total_memory_mb, used_memory_mb, status, " +
  "runtime_refs_json, metadata_json";

interface DeviceRow {
  id: string;
  name: string;
  kind: string;
  model: string;
  total_memory_mb: number;
  used_memory_mb: number | null;
  status: string;
  runtime_refs_json: string | null;
  metadata_json: string | null;
}

export interface SeededDeviceRegistry extends DeviceRegistry {
  /** Idempotent upsert used by discovery — not part of the public contract. */
  seed(devices: Device[]): Device[];
}

function inMemoryDeviceRegistry(): SeededDeviceRegistry {
  const store = new Map<string, Device>();

  return {
    list() {
      return Array.from(store.values());
    },

    getById(id) {
      return store.get(id);
    },

    update(id, patch) {
      const existing = store.get(id);
      if (!existing) return undefined;
      const updated: Device = { ...existing, ...patch };
      store.set(id, updated);
      return updated;
    },

    seed(devices) {
      for (const device of devices) {
        store.set(device.id, {
          ...device,
          runtimeRefs: device.runtimeRefs ?? [],
          metadata: device.metadata ?? {},
        });
      }
      return Array.from(store.values());
    },
  };
}

function sqliteDeviceRegistry(db: Database.Database): SeededDeviceRegistry {
  ensureDispatcherSchema(db);

  const statement = {
    selectAll: db.prepare(
      `SELECT ${DEVICE_COLUMNS} FROM dispatcher_devices ORDER BY name ASC`,
    ),
    selectById: db.prepare(
      `SELECT ${DEVICE_COLUMNS} FROM dispatcher_devices WHERE id = ?`,
    ),
    update: db.prepare(
      `UPDATE dispatcher_devices SET
         name = @name, kind = @kind, model = @model,
         total_memory_mb = @totalMemoryMb, used_memory_mb = @usedMemoryMb,
         status = @status, runtime_refs_json = @runtimeRefsJson,
         metadata_json = @metadataJson
       WHERE id = @id`,
    ),
    upsert: db.prepare(
      `INSERT INTO dispatcher_devices (${DEVICE_COLUMNS})
       VALUES (@id, @name, @kind, @model, @totalMemoryMb, @usedMemoryMb,
               @status, @runtimeRefsJson, @metadataJson)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, kind = excluded.kind, model = excluded.model,
         total_memory_mb = excluded.total_memory_mb,
         used_memory_mb = excluded.used_memory_mb,
         status = excluded.status,
         runtime_refs_json = excluded.runtime_refs_json,
         metadata_json = excluded.metadata_json`,
    ),
  };

  function toRow(device: Device): Record<string, unknown> {
    return {
      id: device.id,
      name: device.name,
      kind: device.kind,
      model: device.model,
      totalMemoryMb: device.totalMemoryMb,
      usedMemoryMb: device.usedMemoryMb ?? null,
      status: device.status,
      runtimeRefsJson: JSON.stringify(device.runtimeRefs ?? []),
      metadataJson: JSON.stringify(device.metadata ?? {}),
    };
  }

  function toDevice(row: DeviceRow): Device {
    return {
      id: row.id,
      name: row.name,
      kind: row.kind as DeviceKind,
      model: row.model,
      totalMemoryMb: row.total_memory_mb,
      usedMemoryMb: row.used_memory_mb ?? undefined,
      status: row.status as DeviceStatus,
      runtimeRefs: parseJson<string[]>(row.runtime_refs_json, []),
      metadata: parseJson<Record<string, unknown>>(row.metadata_json, {}),
    };
  }

  function getById(id: string): Device | undefined {
    const row = statement.selectById.get(id) as DeviceRow | undefined;
    return row ? toDevice(row) : undefined;
  }

  function listAll(): Device[] {
    const rows = statement.selectAll.all() as DeviceRow[];
    return rows.map(toDevice);
  }

  return {
    list: listAll,

    getById,

    update(id, patch) {
      const existing = getById(id);
      if (!existing) return undefined;
      const updated: Device = { ...existing, ...patch };
      statement.update.run(toRow(updated));
      return updated;
    },

    seed(devices) {
      for (const device of devices) {
        statement.upsert.run(toRow(device));
      }
      return listAll();
    },
  };
}

export function createDeviceRegistry(): SeededDeviceRegistry {
  return inMemoryDeviceRegistry();
}

export function createSqliteDeviceRegistry(db: Database.Database): SeededDeviceRegistry {
  return sqliteDeviceRegistry(db);
}