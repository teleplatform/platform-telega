/**
 * @tele-gpt/dispatcher-core — Routing Registry
 *
 * Two interchangeable implementations of the RoutingRegistry (routing rules
 * control-plane contract, Phase 6A):
 *   - createRoutingRegistry()          — in-memory (tests, fallback)
 *   - createSqliteRoutingRegistry(db)  — persistent, shared .data DB
 *
 * IMPORTANT (Phase 6A scope):
 *   - This is control-plane STORAGE ONLY. Rules stored here never affect
 *     production routing: src/core/router.ts, provider-selection-orchestrator,
 *     scoring, health checks and capability ranking are untouched. There is
 *     deliberately NO getRoutingOverrides() integration and no dry-run/explain
 *     yet — those arrive in later phases.
 *
 * Deterministic semantics (both implementations):
 *   - list() is ordered by priority DESC, then id ASC — a stable total order,
 *     so equal-priority rules never order randomly.
 *   - create() with an existing id throws
 *   - getById()/update() with a missing id return undefined
 *   - remove() with a missing id returns false
 */

import type Database from "better-sqlite3";
import { ensureDispatcherSchema } from "./schema.js";
import { isUniqueConstraintError, parseJson } from "./sqlite.js";
import type {
  RoutingAction,
  RoutingCondition,
  RoutingRegistry,
  RoutingRule,
} from "./types.js";

const ROUTING_COLUMNS = "id, name, priority, enabled, condition_json, action_json";

interface RoutingRow {
  id: string;
  name: string;
  priority: number;
  enabled: number;
  condition_json: string;
  action_json: string;
}

const ERROR_DUPLICATE_PREFIX = "Routing rule already exists: ";

/** priority DESC, then id ASC — stable total order. */
function sortRules(rules: RoutingRule[]): RoutingRule[] {
  return [...rules].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return a.id.localeCompare(b.id);
  });
}

function inMemoryRoutingRegistry(): RoutingRegistry {
  const store = new Map<string, RoutingRule>();

  function getById(id: string): RoutingRule | undefined {
    return store.get(id);
  }

  return {
    list() {
      return sortRules(Array.from(store.values()));
    },

    getById,

    create(rule) {
      if (store.has(rule.id)) {
        throw new Error(ERROR_DUPLICATE_PREFIX + rule.id);
      }
      const entry: RoutingRule = {
        ...rule,
        condition: rule.condition ?? {},
        action: rule.action ?? {},
      };
      store.set(entry.id, entry);
      return entry;
    },

    update(id, patch) {
      const existing = store.get(id);
      if (!existing) return undefined;
      const updated: RoutingRule = { ...existing, ...patch };
      store.set(id, updated);
      return updated;
    },

    remove(id) {
      return store.delete(id);
    },
  };
}

function sqliteRoutingRegistry(db: Database.Database): RoutingRegistry {
  ensureDispatcherSchema(db);

  const statement = {
    insert: db.prepare(
      `INSERT INTO dispatcher_routing_rules (${ROUTING_COLUMNS})
       VALUES (@id, @name, @priority, @enabled, @conditionJson, @actionJson)`,
    ),
    selectAll: db.prepare(
      `SELECT ${ROUTING_COLUMNS} FROM dispatcher_routing_rules
       ORDER BY priority DESC, id ASC`,
    ),
    selectById: db.prepare(
      `SELECT ${ROUTING_COLUMNS} FROM dispatcher_routing_rules WHERE id = ?`,
    ),
    update: db.prepare(
      `UPDATE dispatcher_routing_rules SET
         name = @name, priority = @priority, enabled = @enabled,
         condition_json = @conditionJson, action_json = @actionJson
       WHERE id = @id`,
    ),
    remove: db.prepare(`DELETE FROM dispatcher_routing_rules WHERE id = ?`),
  };

  function toRow(rule: RoutingRule): Record<string, unknown> {
    return {
      id: rule.id,
      name: rule.name,
      priority: rule.priority,
      enabled: rule.enabled ? 1 : 0,
      conditionJson: JSON.stringify(rule.condition ?? {}),
      actionJson: JSON.stringify(rule.action ?? {}),
    };
  }

  function toRule(row: RoutingRow): RoutingRule {
    return {
      id: row.id,
      name: row.name,
      priority: row.priority,
      enabled: row.enabled === 1,
      condition: parseJson<RoutingCondition>(row.condition_json, {}),
      action: parseJson<RoutingAction>(row.action_json, {} as RoutingAction),
    };
  }

  function getById(id: string): RoutingRule | undefined {
    const row = statement.selectById.get(id) as RoutingRow | undefined;
    return row ? toRule(row) : undefined;
  }

  return {
    list() {
      const rows = statement.selectAll.all() as RoutingRow[];
      return rows.map(toRule);
    },

    getById,

    create(rule) {
      const entry: RoutingRule = {
        ...rule,
        condition: rule.condition ?? {},
        action: rule.action ?? {},
      };
      try {
        statement.insert.run(toRow(entry));
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
      const updated: RoutingRule = { ...existing, ...patch };
      statement.update.run(toRow(updated));
      return updated;
    },

    remove(id) {
      return statement.remove.run(id).changes > 0;
    },
  };
}

export function createRoutingRegistry(): RoutingRegistry {
  return inMemoryRoutingRegistry();
}

export function createSqliteRoutingRegistry(db: Database.Database): RoutingRegistry {
  return sqliteRoutingRegistry(db);
}