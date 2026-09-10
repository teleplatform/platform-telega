/**
 * @tele-gpt/dispatcher-core — SQLite Schema (models + providers + runtimes + devices)
 *
 * Follows the repo's migration pattern: CREATE TABLE IF NOT EXISTS,
 * applied idempotently at connection time.
 *
 * Key fields are stored as real columns so the Dispatcher UI can filter
 * and order without parsing JSON. Only flexible/arbitrary payloads live in
 * *_json columns.
 *
 * IMPORTANT: Never store raw API keys/secrets here — only the env var
 * reference (api_key_env).
 */

import type Database from "better-sqlite3";

const CREATE_MODELS_TABLE = `
CREATE TABLE IF NOT EXISTS dispatcher_models (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  family            TEXT NOT NULL,
  version           TEXT NOT NULL,
  format            TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'active',
  source            TEXT NOT NULL DEFAULT 'registry',
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  manifest_json     TEXT NOT NULL DEFAULT '{}',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
)`;

const CREATE_MODEL_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_dispatcher_models_status  ON dispatcher_models (status);
CREATE INDEX IF NOT EXISTS idx_dispatcher_models_family  ON dispatcher_models (family);
CREATE INDEX IF NOT EXISTS idx_dispatcher_models_source  ON dispatcher_models (source)`;

const CREATE_PROVIDERS_TABLE = `
CREATE TABLE IF NOT EXISTS dispatcher_providers (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  kind                 TEXT NOT NULL,
  enabled              INTEGER NOT NULL DEFAULT 1,
  priority             INTEGER NOT NULL DEFAULT 0,
  base_url             TEXT,
  api_key_env          TEXT,
  health_status        TEXT NOT NULL DEFAULT 'unknown',
  health_last_check    TEXT,
  health_latency_ms    INTEGER,
  health_error_rate    REAL,
  health_success_count INTEGER NOT NULL DEFAULT 0,
  health_fail_count    INTEGER NOT NULL DEFAULT 0,
  runtime_refs_json    TEXT NOT NULL DEFAULT '[]',
  cost_per_token_json  TEXT,
  capabilities_json    TEXT NOT NULL DEFAULT '[]',
  created_at           TEXT NOT NULL
)`;

const CREATE_PROVIDER_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_dispatcher_providers_kind     ON dispatcher_providers (kind);
CREATE INDEX IF NOT EXISTS idx_dispatcher_providers_enabled  ON dispatcher_providers (enabled);
CREATE INDEX IF NOT EXISTS idx_dispatcher_providers_priority ON dispatcher_providers (priority)
  `;

const CREATE_RUNTIMES_TABLE = `
CREATE TABLE IF NOT EXISTS dispatcher_runtimes (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  kind                  TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'available',
  endpoint              TEXT,
  devices_json          TEXT NOT NULL DEFAULT '[]',
  supported_formats_json TEXT NOT NULL DEFAULT '[]',
  max_concurrent        INTEGER NOT NULL DEFAULT 1,
  config_json           TEXT NOT NULL DEFAULT '{}',
  created_at            TEXT NOT NULL
)`;

const CREATE_RUNTIME_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_dispatcher_runtimes_kind   ON dispatcher_runtimes (kind);
CREATE INDEX IF NOT EXISTS idx_dispatcher_runtimes_status ON dispatcher_runtimes (status)`;

const CREATE_DEVICES_TABLE = `
CREATE TABLE IF NOT EXISTS dispatcher_devices (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  kind             TEXT NOT NULL,
  model            TEXT NOT NULL,
  total_memory_mb  INTEGER NOT NULL,
  used_memory_mb   INTEGER,
  status           TEXT NOT NULL DEFAULT 'available',
  runtime_refs_json TEXT NOT NULL DEFAULT '[]',
  metadata_json    TEXT NOT NULL DEFAULT '{}'
)`;

const CREATE_DEVICE_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_dispatcher_devices_kind   ON dispatcher_devices (kind);
CREATE INDEX IF NOT EXISTS idx_dispatcher_devices_status ON dispatcher_devices (status)`;

const CREATE_ROUTING_RULES_TABLE = `
CREATE TABLE IF NOT EXISTS dispatcher_routing_rules (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  priority       INTEGER NOT NULL DEFAULT 0,
  enabled        INTEGER NOT NULL DEFAULT 1,
  condition_json TEXT NOT NULL DEFAULT '{}',
  action_json    TEXT NOT NULL DEFAULT '{}'
)`;

// Deterministic policy ordering: higher priority first, then id as a stable
// tiebreaker so equal-priority rules never order randomly.
const CREATE_ROUTING_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_dispatcher_routing_order   ON dispatcher_routing_rules (priority DESC, id ASC);
CREATE INDEX IF NOT EXISTS idx_dispatcher_routing_enabled ON dispatcher_routing_rules (enabled)`;

const STATEMENTS = [
  CREATE_MODELS_TABLE,
  CREATE_MODEL_INDEXES,
  CREATE_PROVIDERS_TABLE,
  CREATE_PROVIDER_INDEXES,
  CREATE_RUNTIMES_TABLE,
  CREATE_RUNTIME_INDEXES,
  CREATE_DEVICES_TABLE,
  CREATE_DEVICE_INDEXES,
  CREATE_ROUTING_RULES_TABLE,
  CREATE_ROUTING_INDEXES,
];

/**
 * Idempotently ensure dispatcher tables exist on any SQLite connection.
 * Safe to call multiple times on the same DB.
 */
export function ensureDispatcherSchema(db: Database.Database): void {
  for (const stmt of STATEMENTS) {
    db.exec(stmt);
  }
}