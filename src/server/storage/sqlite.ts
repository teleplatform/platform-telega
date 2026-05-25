import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ApiErrorCode } from "../../types/api.js";
import type { BuildTask } from "../../types/telecore.js";

import { createBuildTaskMissionEvent } from "../../runtime/mission-control/build-task-event.js";
import { emitMissionControlLiveEvent } from "../../runtime/hooks/mission-control-live-feed-hook.js";
import { appendMissionControlPersistenceFeed } from "../../runtime/mission-control/operational-runtime.js";
import { deliverBuildTaskMissionEvent } from "../../runtime/mission-control/delivery/telegram-build-task-delivery.js";
import { getRetryDecision } from "../../runtime/forge-bridge/retry-policy.js";

export type AskTrace = {
  trace_id: string;
  message: string;
  reply: string;
  mode: "echo" | "openai";
  provider: "local" | "openai" | "core";
  model?: string;
  user_id?: string;
  created_at: number;
  ok: 1 | 0;
  duration_ms?: number;
  latency_ms?: number;
  request_bytes?: number;
  reply_bytes?: number;
  tokens_in?: number;
  tokens_out?: number;
  cost_usd?: number;
  error_code?: ApiErrorCode;
  error_message?: string;
  lane?: string | null;
  intent?: string | null;
  intent_source?: string | null;
  intent_reason?: string | null;
  fallback_used?: number | null;
  failures_count?: number | null;
  timeouts?: number | null;
  max_tokens?: number | null;
  knowledge_source?: string | null;
  knowledge_business_id?: string | null;
  knowledge_version?: number | string | null;
  knowledge_etag?: string | null;
  intent_confidence?: number | null;
  generated_task_id?: string | null;
  actionability_score?: number | null;
  gate_reason?: string | null;
  artifacts_count?: number | null;
  skill_id?: string | null;
  skill_stage?: string | null;
  issues_count?: number | null;
  patch_bytes?: number | null;
  maker_mode?: number | null;
  duration_sec?: number | null;
  validators_mp4_exists?: number | null;
  validators_duration_ok?: number | null;
  validators_aspect_9x16?: number | null;
  validators_audio_present?: number | null;
  lrl_event_type?: string | null;
  lrl_event_id?: string | null;
  award_teleton?: number | null;
  award_bonus?: number | null;
  wallet_teleton_delta_applied?: number | null;
  wallet_bonus_delta_applied?: number | null;
  fraud_flags_count?: number | null;
  action_map_id?: string | null;
};

export type HistoryQuery = {
  user_id?: string;
  limit?: number;
};

// KCA-4 Lifecycle State Semantics (canonical for Tele•GPT execution)
// terminal      : final, no further automatic execution
// protected     : regression blocked (needs explicit Creator action to change)
// self_healing  : transitional recovery (can go running → failed → needs_creator → done)
// needs_creator : paused, gated on human decision
export type BuildTaskRow = {
  task_id: string;
  status: "queued" | "running" | "retrying" | "done" | "partial" | "blocked" | "failed" | "cancelled" | "timed_out" | "self_healing" | "needs_creator";
  visibility: "public" | "creator" | "core";
  title: string;
  created_at: number;
  updated_at: number;
  task_json: string;
  result_json?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  blocked_reason?: string | null;
  runner_id?: string | null;
  heartbeat_at?: number | null;
  progress?: number | null;
  note?: string | null;
  version?: number;
  source_trace_id?: string | null;
  queued_at?: number | null;
  started_at?: number | null;
  completed_at?: number | null;
  retry_count?: number;
  executor_target?: string | null;
  executor_id?: string | null;
  last_error?: string | null;
  next_retry_at?: number | null;
  needs_creator_reason?: string | null;
  decision_options?: string | null;
  resume_token?: string | null;
  creator_decision_status?: string | null;
  creator_decision_at?: number | null;
};

export type KbEntryRow = {
  key: string;
  payload_json: string;
  version: number;
  etag: string;
  updated_at: string;
  created_at: string;
};

export type TaskArtifactRow = {
  id: string;
  task_id: string;
  name: string;
  mime: string;
  path: string;
  bytes: number;
  created_at: number;
};

function columnExists(db: Database.Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  return rows.some((r) => r.name === column);
}

function addColumnIfMissing(
  db: Database.Database,
  table: string,
  column: string,
  sqlType: string
) {
  if (!columnExists(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${sqlType}`);
  }
}

function tableExists(db: Database.Database, table: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get(table) as { name?: string } | undefined;
  return Boolean(row?.name);
}

export function initSqlite(dbFile: string) {
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });

  const db = new Database(dbFile);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS ask_traces (
      trace_id   TEXT PRIMARY KEY,
      message    TEXT NOT NULL,
      reply      TEXT NOT NULL,
      mode       TEXT NOT NULL,
      provider   TEXT NOT NULL,
      model      TEXT,
      user_id    TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ask_traces_user_created
    ON ask_traces (user_id, created_at DESC);
  `);

  // --- KB-2 storage (legacy: business_id/version/payload_json)
  // We need canonical names knowledge_packs/knowledge_docs for product knowledge.
  // If an older DB has KB-2 in knowledge_packs, migrate it to knowledge_packs_kb2.
  try {
    const isLegacyKb2 =
      tableExists(db, "knowledge_packs") && columnExists(db, "knowledge_packs", "business_id");
    if (isLegacyKb2 && !tableExists(db, "knowledge_packs_kb2")) {
      db.exec("ALTER TABLE knowledge_packs RENAME TO knowledge_packs_kb2");
    }
  } catch {
    // ignore (best-effort)
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_packs_kb2 (
      business_id  TEXT PRIMARY KEY,
      version      INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at   INTEGER NOT NULL,
      etag         TEXT
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_knowledge_packs_kb2_updated
    ON knowledge_packs_kb2 (updated_at DESC);
  `);

  // Backwards compat: older installs may have had `json` instead of `payload_json`.
  addColumnIfMissing(db, "knowledge_packs_kb2", "payload_json", "TEXT");
  addColumnIfMissing(db, "knowledge_packs_kb2", "etag", "TEXT");
  addColumnIfMissing(db, "knowledge_packs_kb2", "json", "TEXT");

  // One-time best-effort migration: copy json -> payload_json.
  try {
    db.exec(
      "UPDATE knowledge_packs_kb2 SET payload_json = json WHERE (payload_json IS NULL OR payload_json = '') AND json IS NOT NULL AND json <> ''"
    );
  } catch {
    // ignore
  }

  // --- Product knowledge (packs/docs/versions)
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_packs (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL,
      scope      TEXT NOT NULL,
      owner_id   TEXT NOT NULL,
      is_active  INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_knowledge_packs_active_scope
    ON knowledge_packs (is_active, scope, created_at DESC);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_docs (
      id         TEXT PRIMARY KEY,
      pack_id    TEXT NOT NULL,
      kind       TEXT NOT NULL,
      title      TEXT NOT NULL,
      body_md    TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(pack_id) REFERENCES knowledge_packs(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_knowledge_docs_pack_updated
    ON knowledge_docs (pack_id, updated_at DESC);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_doc_versions (
      id         TEXT PRIMARY KEY,
      doc_id     TEXT NOT NULL,
      body_md    TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(doc_id) REFERENCES knowledge_docs(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_knowledge_doc_versions_doc_created
    ON knowledge_doc_versions (doc_id, created_at DESC);
  `);

  // Agent traces (Sales/Support Agent)
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_traces (
      trace_id     TEXT PRIMARY KEY,
      mode         TEXT NOT NULL,
      message      TEXT NOT NULL,
      decision_json TEXT NOT NULL,
      citations_json TEXT,
      provider     TEXT,
      model        TEXT,
      created_at   INTEGER NOT NULL,
      ok           INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_agent_traces_created
    ON agent_traces (created_at DESC);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS build_tasks (
      task_id     TEXT PRIMARY KEY,
      status      TEXT NOT NULL,
      visibility  TEXT NOT NULL,
      title       TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL,
      task_json   TEXT NOT NULL,
      result_json TEXT,
      error_code  TEXT,
      error_message TEXT
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS kb_entries (
      key TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      etag TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS wallets (
      user_id TEXT PRIMARY KEY,
      teleton_balance INTEGER NOT NULL DEFAULT 0,
      bonus_points_balance INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS wallet_ledger (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      asset TEXT NOT NULL,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      event_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_ledger_event
    ON wallet_ledger (user_id, asset, event_id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS lrl_events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      user_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      status TEXT NOT NULL,
      blocked_reason TEXT,
      created_at TEXT NOT NULL,
      processed_at TEXT
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_lrl_events_status
    ON lrl_events (status, created_at DESC);
  `);

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_lrl_events_hash
    ON lrl_events (type, user_id, payload_hash);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS lrl_rules (
      id TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      event_type TEXT NOT NULL,
      award_teleton INTEGER NOT NULL DEFAULT 0,
      award_bonus INTEGER NOT NULL DEFAULT 0,
      daily_cap_teleton INTEGER NOT NULL DEFAULT 0,
      daily_cap_bonus INTEGER NOT NULL DEFAULT 0,
      conditions_json TEXT NOT NULL DEFAULT "{}",
      updated_at TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_lrl_rules_type
    ON lrl_rules (event_type);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS review_gate (
      review_id TEXT PRIMARY KEY,
      stars INTEGER NOT NULL,
      visibility TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS task_artifacts (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      name TEXT NOT NULL,
      mime TEXT NOT NULL,
      path TEXT NOT NULL,
      bytes INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_task_artifacts_task
    ON task_artifacts (task_id, created_at DESC);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_build_tasks_updated
    ON build_tasks (updated_at DESC);
  `);

  addColumnIfMissing(db, "build_tasks", "runner_id", "TEXT");
  addColumnIfMissing(db, "build_tasks", "heartbeat_at", "INTEGER");
  addColumnIfMissing(db, "build_tasks", "progress", "INTEGER");
  addColumnIfMissing(db, "build_tasks", "note", "TEXT");
  addColumnIfMissing(db, "build_tasks", "blocked_reason", "TEXT");
  addColumnIfMissing(db, "build_tasks", "version", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "build_tasks", "source_trace_id", "TEXT");
  addColumnIfMissing(db, "build_tasks", "queued_at", "INTEGER");
  addColumnIfMissing(db, "build_tasks", "started_at", "INTEGER");
  addColumnIfMissing(db, "build_tasks", "completed_at", "INTEGER");
  addColumnIfMissing(db, "build_tasks", "retry_count", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "build_tasks", "next_retry_at", "INTEGER");
  addColumnIfMissing(db, "build_tasks", "needs_creator_reason", "TEXT");
  addColumnIfMissing(db, "build_tasks", "decision_options", "TEXT");
  addColumnIfMissing(db, "build_tasks", "resume_token", "TEXT");
  addColumnIfMissing(db, "build_tasks", "creator_decision_status", "TEXT");
  addColumnIfMissing(db, "build_tasks", "creator_decision_at", "INTEGER");
  addColumnIfMissing(db, "build_tasks", "executor_target", "TEXT");
  addColumnIfMissing(db, "build_tasks", "executor_id", "TEXT");
  addColumnIfMissing(db, "build_tasks", "last_error", "TEXT");

  addColumnIfMissing(db, "ask_traces", "ok", "INTEGER NOT NULL DEFAULT 1");
  addColumnIfMissing(db, "ask_traces", "duration_ms", "INTEGER");
  addColumnIfMissing(db, "ask_traces", "latency_ms", "INTEGER");
  addColumnIfMissing(db, "ask_traces", "request_bytes", "INTEGER");
  addColumnIfMissing(db, "ask_traces", "reply_bytes", "INTEGER");
  addColumnIfMissing(db, "ask_traces", "tokens_in", "INTEGER");
  addColumnIfMissing(db, "ask_traces", "tokens_out", "INTEGER");
  addColumnIfMissing(db, "ask_traces", "cost_usd", "REAL");
  addColumnIfMissing(db, "ask_traces", "error_code", "TEXT");
  addColumnIfMissing(db, "ask_traces", "error_message", "TEXT");
  addColumnIfMissing(db, "ask_traces", "lane", "TEXT");
  addColumnIfMissing(db, "ask_traces", "intent", "TEXT");
  addColumnIfMissing(db, "ask_traces", "intent_source", "TEXT");
  addColumnIfMissing(db, "ask_traces", "intent_reason", "TEXT");
  addColumnIfMissing(db, "ask_traces", "intent_confidence", "REAL");
  addColumnIfMissing(db, "ask_traces", "fallback_used", "INTEGER");
  addColumnIfMissing(db, "ask_traces", "failures_count", "INTEGER");
  addColumnIfMissing(db, "ask_traces", "timeouts", "INTEGER");
  addColumnIfMissing(db, "ask_traces", "max_tokens", "INTEGER");
  addColumnIfMissing(db, "ask_traces", "knowledge_source", "TEXT");
  addColumnIfMissing(db, "ask_traces", "knowledge_business_id", "TEXT");
  addColumnIfMissing(db, "ask_traces", "knowledge_version", "INTEGER");
  addColumnIfMissing(db, "ask_traces", "knowledge_etag", "TEXT");
  addColumnIfMissing(db, "ask_traces", "generated_task_id", "TEXT");
  addColumnIfMissing(db, "ask_traces", "actionability_score", "INTEGER");
  addColumnIfMissing(db, "ask_traces", "gate_reason", "TEXT");
  addColumnIfMissing(db, "ask_traces", "artifacts_count", "INTEGER");
  addColumnIfMissing(db, "ask_traces", "skill_id", "TEXT");
  addColumnIfMissing(db, "ask_traces", "skill_stage", "TEXT");
  addColumnIfMissing(db, "ask_traces", "issues_count", "INTEGER");
  addColumnIfMissing(db, "ask_traces", "patch_bytes", "INTEGER");
  addColumnIfMissing(db, "ask_traces", "maker_mode", "INTEGER");
  addColumnIfMissing(db, "ask_traces", "duration_sec", "INTEGER");
  addColumnIfMissing(db, "ask_traces", "validators_mp4_exists", "INTEGER");
  addColumnIfMissing(db, "ask_traces", "validators_duration_ok", "INTEGER");
  addColumnIfMissing(db, "ask_traces", "validators_aspect_9x16", "INTEGER");
  addColumnIfMissing(db, "ask_traces", "validators_audio_present", "INTEGER");
  addColumnIfMissing(db, "ask_traces", "lrl_event_type", "TEXT");
  addColumnIfMissing(db, "ask_traces", "lrl_event_id", "TEXT");
  addColumnIfMissing(db, "ask_traces", "award_teleton", "INTEGER");
  addColumnIfMissing(db, "ask_traces", "award_bonus", "INTEGER");
  addColumnIfMissing(db, "ask_traces", "wallet_teleton_delta_applied", "INTEGER");
  addColumnIfMissing(db, "ask_traces", "wallet_bonus_delta_applied", "INTEGER");
  addColumnIfMissing(db, "ask_traces", "fraud_flags_count", "INTEGER");
  addColumnIfMissing(db, "ask_traces", "action_map_id", "TEXT");

  const insertStmt = db.prepare(`
    INSERT INTO ask_traces (
      trace_id, message, reply, mode, provider, model, user_id, created_at,
      ok, duration_ms, latency_ms, request_bytes, reply_bytes, tokens_in, tokens_out,
      cost_usd, error_code, error_message,
      lane, intent, intent_source, intent_reason, fallback_used, failures_count, timeouts, max_tokens,
      knowledge_source, knowledge_business_id, knowledge_version, knowledge_etag,
      intent_confidence,
      generated_task_id, actionability_score, gate_reason, artifacts_count,
      skill_id, skill_stage, issues_count, patch_bytes, maker_mode,
      duration_sec, validators_mp4_exists, validators_duration_ok, validators_aspect_9x16, validators_audio_present,
      lrl_event_type, lrl_event_id, award_teleton, award_bonus, wallet_teleton_delta_applied,
      wallet_bonus_delta_applied, fraud_flags_count, action_map_id
    ) VALUES (
      @trace_id, @message, @reply, @mode, @provider, @model, @user_id, @created_at,
      @ok, @duration_ms, @latency_ms, @request_bytes, @reply_bytes, @tokens_in,
      @tokens_out, @cost_usd, @error_code, @error_message,
      @lane, @intent, @intent_source, @intent_reason, @fallback_used, @failures_count, @timeouts, @max_tokens,
      @knowledge_source, @knowledge_business_id, @knowledge_version, @knowledge_etag,
      @intent_confidence,
      @generated_task_id, @actionability_score, @gate_reason, @artifacts_count,
      @skill_id, @skill_stage, @issues_count, @patch_bytes, @maker_mode,
      @duration_sec, @validators_mp4_exists, @validators_duration_ok, @validators_aspect_9x16, @validators_audio_present,
      @lrl_event_type, @lrl_event_id, @award_teleton, @award_bonus, @wallet_teleton_delta_applied,
      @wallet_bonus_delta_applied, @fraud_flags_count, @action_map_id
    )
  `);

  const getStmt = db.prepare(`
    SELECT trace_id, message, reply, mode, provider, model, user_id, created_at,
           ok, duration_ms, latency_ms, request_bytes, reply_bytes, tokens_in,
           tokens_out, cost_usd, error_code, error_message,
           lane, intent, intent_source, intent_reason, fallback_used, failures_count, timeouts, max_tokens,
           knowledge_source, knowledge_business_id, knowledge_version, knowledge_etag,
           intent_confidence,
           generated_task_id, actionability_score, gate_reason, artifacts_count,
           skill_id, skill_stage, issues_count, patch_bytes, maker_mode,
           duration_sec, validators_mp4_exists, validators_duration_ok, validators_aspect_9x16, validators_audio_present,
           lrl_event_type, lrl_event_id, award_teleton, award_bonus, wallet_teleton_delta_applied,
           wallet_bonus_delta_applied, fraud_flags_count, action_map_id
    FROM ask_traces
    WHERE trace_id = ?
  `);

  const listAllStmt = db.prepare(`
    SELECT trace_id, message, reply, mode, provider, model, user_id, created_at,
           ok, duration_ms, latency_ms, request_bytes, reply_bytes, tokens_in,
           tokens_out, cost_usd, error_code, error_message,
           lane, intent, intent_source, intent_reason, fallback_used, failures_count, timeouts, max_tokens,
           knowledge_source, knowledge_business_id, knowledge_version, knowledge_etag,
           intent_confidence,
           generated_task_id, actionability_score, gate_reason, artifacts_count,
           skill_id, skill_stage, issues_count, patch_bytes, maker_mode,
           duration_sec, validators_mp4_exists, validators_duration_ok, validators_aspect_9x16, validators_audio_present,
           lrl_event_type, lrl_event_id, award_teleton, award_bonus, wallet_teleton_delta_applied,
           wallet_bonus_delta_applied, fraud_flags_count, action_map_id
    FROM ask_traces
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const deleteTracesBeforeStmt = db.prepare(`
    DELETE FROM ask_traces
    WHERE created_at < ?
  `);

  const listUserStmt = db.prepare(`
    SELECT trace_id, message, reply, mode, provider, model, user_id, created_at,
           ok, duration_ms, latency_ms, request_bytes, reply_bytes, tokens_in,
           tokens_out, cost_usd, error_code, error_message,
           lane, intent, intent_source, intent_reason, fallback_used, failures_count, timeouts, max_tokens,
           knowledge_source, knowledge_business_id, knowledge_version, knowledge_etag,
           intent_confidence,
           generated_task_id, actionability_score, gate_reason, artifacts_count,
           skill_id, skill_stage, issues_count, patch_bytes, maker_mode,
           duration_sec, validators_mp4_exists, validators_duration_ok, validators_aspect_9x16, validators_audio_present,
           lrl_event_type, lrl_event_id, award_teleton, award_bonus, wallet_teleton_delta_applied,
           wallet_bonus_delta_applied, fraud_flags_count, action_map_id
    FROM ask_traces
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const upsertTaskStmt = db.prepare(`
    INSERT INTO build_tasks (
      task_id, status, visibility, title, created_at, updated_at, task_json, queued_at
    ) VALUES (
      @task_id, @status, @visibility, @title, @created_at, @updated_at, @task_json, @queued_at
    )
    ON CONFLICT(task_id) DO UPDATE SET
      visibility = excluded.visibility,
      title = excluded.title,
      task_json = excluded.task_json,
      updated_at = excluded.updated_at,
      queued_at = COALESCE(excluded.queued_at, queued_at)
  `);

  const setResultStmt = db.prepare(`
    UPDATE build_tasks
    SET status = ?, result_json = ?, updated_at = ?, error_code = ?, error_message = ?,
        completed_at = COALESCE(?, completed_at),
        last_error = COALESCE(?, last_error),
        executor_target = COALESCE(?, executor_target),
        executor_id = COALESCE(?, executor_id)
    WHERE task_id = ?
      AND status NOT IN ('done','partial','blocked','failed','cancelled','timed_out','needs_creator')
  `);

  const insertArtifactStmt = db.prepare(`
    INSERT INTO task_artifacts (
      id, task_id, name, mime, path, bytes, created_at
    ) VALUES (
      @id, @task_id, @name, @mime, @path, @bytes, @created_at
    )
  `);

  const listArtifactsStmt = db.prepare(`
    SELECT id, task_id, name, mime, path, bytes, created_at
    FROM task_artifacts
    WHERE task_id = ?
    ORDER BY created_at DESC
  `);

  const getArtifactStmt = db.prepare(`
    SELECT id, task_id, name, mime, path, bytes, created_at
    FROM task_artifacts
    WHERE id = ?
  `);

  const getKbEntryStmt = db.prepare(`
    SELECT key, payload_json, version, etag, updated_at, created_at
    FROM kb_entries
    WHERE key = ?
  `);

  const insertKbEntryStmt = db.prepare(`
    INSERT INTO kb_entries (key, payload_json, version, etag, updated_at, created_at)
    VALUES (@key, @payload_json, @version, @etag, @updated_at, @created_at)
  `);

  const updateKbEntryStmt = db.prepare(`
    UPDATE kb_entries
    SET payload_json = @payload_json,
        version = @version,
        etag = @etag,
        updated_at = @updated_at
    WHERE key = @key
  `);

  const getWalletStmt = db.prepare(`
    SELECT user_id, teleton_balance, bonus_points_balance, updated_at
    FROM wallets
    WHERE user_id = ?
  `);

  const upsertWalletStmt = db.prepare(`
    INSERT INTO wallets (user_id, teleton_balance, bonus_points_balance, updated_at)
    VALUES (@user_id, @teleton_balance, @bonus_points_balance, @updated_at)
    ON CONFLICT(user_id) DO UPDATE SET
      teleton_balance = excluded.teleton_balance,
      bonus_points_balance = excluded.bonus_points_balance,
      updated_at = excluded.updated_at
  `);

  const insertLedgerStmt = db.prepare(`
    INSERT INTO wallet_ledger (id, user_id, asset, delta, reason, event_id, created_at)
    VALUES (@id, @user_id, @asset, @delta, @reason, @event_id, @created_at)
  `);

  const listLedgerStmt = db.prepare(`
    SELECT id, user_id, asset, delta, reason, event_id, created_at
    FROM wallet_ledger
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const sumLedgerDayStmt = db.prepare(`
    SELECT COALESCE(SUM(delta),0) as total
    FROM wallet_ledger
    WHERE user_id = ?
      AND asset = ?
      AND date(created_at) = date(?)
  `);

  const insertLrlEventStmt = db.prepare(`
    INSERT INTO lrl_events (id, type, user_id, payload_json, payload_hash, status, blocked_reason, created_at)
    VALUES (@id, @type, @user_id, @payload_json, @payload_hash, @status, @blocked_reason, @created_at)
  `);

  const listQueuedEventsStmt = db.prepare(`
    SELECT id, type, user_id, payload_json, payload_hash, status, blocked_reason, created_at
    FROM lrl_events
    WHERE status = 'queued'
    ORDER BY created_at ASC
    LIMIT ?
  `);

  const updateEventStatusStmt = db.prepare(`
    UPDATE lrl_events
    SET status = @status, blocked_reason = @blocked_reason, processed_at = @processed_at
    WHERE id = @id
  `);

  const insertRuleStmt = db.prepare(`
    INSERT INTO lrl_rules (
      id, version, enabled, event_type,
      award_teleton, award_bonus, daily_cap_teleton, daily_cap_bonus,
      conditions_json, updated_at
    ) VALUES (
      @id, @version, @enabled, @event_type,
      @award_teleton, @award_bonus, @daily_cap_teleton, @daily_cap_bonus,
      @conditions_json, @updated_at
    )
  `);

  const listRulesStmt = db.prepare(`
    SELECT id, version, enabled, event_type, award_teleton, award_bonus,
           daily_cap_teleton, daily_cap_bonus, conditions_json, updated_at
    FROM lrl_rules
    ORDER BY event_type ASC
  `);

  const listRulesByTypeStmt = db.prepare(`
    SELECT id, version, enabled, event_type, award_teleton, award_bonus,
           daily_cap_teleton, daily_cap_bonus, conditions_json, updated_at
    FROM lrl_rules
    WHERE event_type = ?
      AND enabled = 1
    ORDER BY version DESC
  `);

  const insertReviewGateStmt = db.prepare(`
    INSERT INTO review_gate (review_id, stars, visibility, created_at)
    VALUES (@review_id, @stars, @visibility, @created_at)
    ON CONFLICT(review_id) DO NOTHING
  `);

  const getLrlEventStmt = db.prepare(`
    SELECT id, type, user_id, payload_json, payload_hash, status, blocked_reason, created_at, processed_at
    FROM lrl_events
    WHERE id = ?
  `);

  const getTaskStmt = db.prepare(`
    SELECT task_id, status, visibility, title, created_at, updated_at, task_json,
           result_json, error_code, error_message, blocked_reason, source_trace_id,
           runner_id, heartbeat_at, progress, note, version,
           queued_at, started_at, completed_at, retry_count, executor_target, executor_id, last_error,
           next_retry_at, needs_creator_reason, decision_options, resume_token,
           creator_decision_status, creator_decision_at
    FROM build_tasks
    WHERE task_id = ?
  `);

  const listTasksStmt = db.prepare(`
    SELECT task_id, status, visibility, title, created_at, updated_at, heartbeat_at, progress,
           queued_at, started_at, completed_at, executor_target, executor_id, last_error
    FROM build_tasks
    ORDER BY updated_at DESC
    LIMIT ?
  `);

  const listTasksByStatusStmt = db.prepare(`
    SELECT task_id, status, visibility, title, created_at, updated_at, heartbeat_at, progress
    FROM build_tasks
    WHERE status = ?
    ORDER BY updated_at DESC
    LIMIT ?
  `);

  const listTasksByVisibilityStmt = db.prepare(`
    SELECT task_id, status, visibility, title, created_at, updated_at, heartbeat_at, progress
    FROM build_tasks
    WHERE visibility = ?
    ORDER BY updated_at DESC
    LIMIT ?
  `);

  const listTasksByStatusVisibilityStmt = db.prepare(`
    SELECT task_id, status, visibility, title, created_at, updated_at, heartbeat_at, progress
    FROM build_tasks
    WHERE status = ? AND visibility = ?
    ORDER BY updated_at DESC
    LIMIT ?
  `);

  const countsStmt = db.prepare(`
    SELECT status, COUNT(*) as c
    FROM build_tasks
    WHERE (?1 IS NULL OR visibility = ?1)
    GROUP BY status
  `);

  const staleExecutionStmt = db.prepare(`
    SELECT COUNT(*) as c
    FROM build_tasks
    WHERE status IN ('running', 'self_healing')
      AND (?1 IS NULL OR visibility = ?1)
      AND (
        heartbeat_at IS NULL OR
        heartbeat_at < ?2
      )
  `);

  const heartbeatStmt = db.prepare(`
    UPDATE build_tasks
    SET status = CASE
        WHEN status IN ('done','partial','blocked') THEN status
        ELSE 'running'
      END,
      runner_id = COALESCE(?, runner_id),
      heartbeat_at = ?,
      progress = COALESCE(?, progress),
      note = COALESCE(?, note),
      updated_at = ?,
      started_at = COALESCE(started_at, ?),
      executor_target = COALESCE(?, executor_target),
      executor_id = COALESCE(?, executor_id)
    WHERE task_id = ?
  `);

  const getHeartbeatStmt = db.prepare(`
    SELECT task_id, status, heartbeat_at, progress
    FROM build_tasks
    WHERE task_id = ?
  `);

  const listStaleRunningTasksStmt = db.prepare(`
    SELECT task_id, status, heartbeat_at, version, task_json, COALESCE(retry_count, 0) AS retry_count
    FROM build_tasks
    WHERE status IN ('running', 'self_healing')
      AND (? IS NULL OR visibility = ?)
      AND (heartbeat_at IS NULL OR heartbeat_at < ?)
  `);

  const scheduledRetryTasksStmt = db.prepare(`
    SELECT task_id, task_json
    FROM build_tasks
    WHERE status = 'retrying'
      AND next_retry_at IS NOT NULL
      AND next_retry_at <= ?
  `);

  const updateTaskCasStmt = db.prepare(`
    UPDATE build_tasks
    SET
      status = COALESCE(@status, status),
      runner_id = COALESCE(@runner_id, runner_id),
      heartbeat_at = COALESCE(@heartbeat_at, heartbeat_at),
      blocked_reason = COALESCE(@blocked_reason, blocked_reason),
      started_at = COALESCE(@started_at, started_at),
      completed_at = COALESCE(@completed_at, completed_at),
      executor_target = COALESCE(@executor_target, executor_target),
      executor_id = COALESCE(@executor_id, executor_id),
      last_error = COALESCE(@last_error, last_error),
      retry_count = COALESCE(@retry_count, retry_count),
      next_retry_at = COALESCE(@next_retry_at, next_retry_at),
      needs_creator_reason = COALESCE(@needs_creator_reason, needs_creator_reason),
      decision_options = COALESCE(@decision_options, decision_options),
      resume_token = COALESCE(@resume_token, resume_token),
      creator_decision_status = COALESCE(@creator_decision_status, creator_decision_status),
      creator_decision_at = COALESCE(@creator_decision_at, creator_decision_at),
      note = COALESCE(@note, note),
      version = version + 1,
      updated_at = @updated_at
    WHERE task_id = @task_id
      AND version = @expected_version
  `);

  const updateTaskSourceTraceStmt = db.prepare(`
    UPDATE build_tasks
    SET source_trace_id = ?
    WHERE task_id = ?
  `);

  const setHeartbeatStaleStmt = db.prepare(`
    UPDATE build_tasks
    SET heartbeat_at = ?, updated_at = ?, version = version + 1
    WHERE task_id = ? AND status = 'running'
  `);

  const TERMINAL = new Set(["done", "partial", "blocked"]);

  const setStatusStmt = db.prepare(`
    UPDATE build_tasks
    SET status = ?2, updated_at = ?3
    WHERE task_id = ?1
      AND status = ?4
      AND status NOT IN ('done','partial','blocked')
  `);

  // KB-2 statements (business_id/version/payload_json)
  const getKb2Stmt = db.prepare(`
    SELECT business_id, version,
           COALESCE(payload_json, json) AS payload_json,
           etag,
           updated_at
    FROM knowledge_packs_kb2
    WHERE business_id = ?
  `);

  const getKb2VersionStmt = db.prepare(`
    SELECT version
    FROM knowledge_packs_kb2
    WHERE business_id = ?
  `);

  const upsertKb2Stmt = db.prepare(`
    INSERT INTO knowledge_packs_kb2 (business_id, version, payload_json, updated_at, etag)
    VALUES (@business_id, @version, @payload_json, @updated_at, @etag)
    ON CONFLICT(business_id) DO UPDATE SET
      version = excluded.version,
      payload_json = excluded.payload_json,
      updated_at = excluded.updated_at,
      etag = excluded.etag
  `);

  // Product knowledge statements
  const listPacksStmt = db.prepare(`
    SELECT id, title, scope, owner_id, is_active, created_at
    FROM knowledge_packs
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const listActivePacksByScopeStmt = db.prepare(`
    SELECT id, title, scope, owner_id, is_active, created_at
    FROM knowledge_packs
    WHERE is_active = 1 AND scope = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const insertPackStmt = db.prepare(`
    INSERT INTO knowledge_packs (id, title, scope, owner_id, is_active, created_at)
    VALUES (@id, @title, @scope, @owner_id, @is_active, @created_at)
  `);

  const setPackActiveStmt = db.prepare(`
    UPDATE knowledge_packs
    SET is_active = ?2
    WHERE id = ?1
  `);

  const listDocsByPackStmt = db.prepare(`
    SELECT id, pack_id, kind, title, body_md, updated_at
    FROM knowledge_docs
    WHERE pack_id = ?
    ORDER BY updated_at DESC
    LIMIT ?
  `);

  const getDocStmt = db.prepare(`
    SELECT id, pack_id, kind, title, body_md, updated_at
    FROM knowledge_docs
    WHERE id = ?
  `);

  const insertDocStmt = db.prepare(`
    INSERT INTO knowledge_docs (id, pack_id, kind, title, body_md, updated_at)
    VALUES (@id, @pack_id, @kind, @title, @body_md, @updated_at)
  `);

  const updateDocStmt = db.prepare(`
    UPDATE knowledge_docs
    SET kind = COALESCE(@kind, kind),
        title = COALESCE(@title, title),
        body_md = COALESCE(@body_md, body_md),
        updated_at = @updated_at
    WHERE id = @id
  `);

  const insertDocVersionStmt = db.prepare(`
    INSERT INTO knowledge_doc_versions (id, doc_id, body_md, created_at)
    VALUES (@id, @doc_id, @body_md, @created_at)
  `);

  // Agent traces
  const insertAgentTraceStmt = db.prepare(`
    INSERT INTO agent_traces (
      trace_id, mode, message, decision_json, citations_json,
      provider, model, created_at, ok
    ) VALUES (
      @trace_id, @mode, @message, @decision_json, @citations_json,
      @provider, @model, @created_at, @ok
    )
  `);

  function makeEtag(payload: string, version: number) {
    const hash = crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16);
    return `${hash}:${version}`;
  }

  return {
    insertTrace(trace: AskTrace) {
      insertStmt.run({
        ...trace,
        duration_ms: trace.duration_ms ?? null,
        latency_ms: trace.latency_ms ?? null,
        request_bytes: trace.request_bytes ?? null,
        reply_bytes: trace.reply_bytes ?? null,
        tokens_in: trace.tokens_in ?? null,
        tokens_out: trace.tokens_out ?? null,
        cost_usd: trace.cost_usd ?? null,
        error_code: trace.error_code ?? null,
        error_message: trace.error_message ?? null,
        lane: trace.lane ?? null,
        intent: trace.intent ?? null,
        intent_source: trace.intent_source ?? null,
        intent_reason: trace.intent_reason ?? null,
        intent_confidence: typeof trace.intent_confidence === "number" ? trace.intent_confidence : null,
        fallback_used: trace.fallback_used ?? null,
        failures_count: trace.failures_count ?? null,
        timeouts: trace.timeouts ?? null,
        max_tokens: trace.max_tokens ?? null,
        knowledge_source: trace.knowledge_source ?? null,
        knowledge_business_id: trace.knowledge_business_id ?? null,
        knowledge_version: trace.knowledge_version ?? null,
        knowledge_etag: trace.knowledge_etag ?? null,
        generated_task_id: trace.generated_task_id ?? null,
        actionability_score: trace.actionability_score ?? null,
        gate_reason: trace.gate_reason ?? null,
        artifacts_count: trace.artifacts_count ?? null,
        skill_id: trace.skill_id ?? null,
        skill_stage: trace.skill_stage ?? null,
        issues_count: trace.issues_count ?? null,
        patch_bytes: trace.patch_bytes ?? null,
        maker_mode: trace.maker_mode ?? null,
        duration_sec: trace.duration_sec ?? null,
        validators_mp4_exists: trace.validators_mp4_exists ?? null,
        validators_duration_ok: trace.validators_duration_ok ?? null,
        validators_aspect_9x16: trace.validators_aspect_9x16 ?? null,
        validators_audio_present: trace.validators_audio_present ?? null,
        lrl_event_type: trace.lrl_event_type ?? null,
        lrl_event_id: trace.lrl_event_id ?? null,
        award_teleton: trace.award_teleton ?? null,
        award_bonus: trace.award_bonus ?? null,
        wallet_teleton_delta_applied: trace.wallet_teleton_delta_applied ?? null,
        wallet_bonus_delta_applied: trace.wallet_bonus_delta_applied ?? null,
        fraud_flags_count: trace.fraud_flags_count ?? null,
        action_map_id: trace.action_map_id ?? null,
      });
    },
    getTrace(traceId: string) {
      return getStmt.get(traceId) as AskTrace | undefined;
    },
    listHistory(query: HistoryQuery) {
      const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
      if (query.user_id) {
        return listUserStmt.all(query.user_id, limit) as AskTrace[];
      }
      return listAllStmt.all(limit) as AskTrace[];
    },
    deleteTracesBefore(cutoffMs: number) {
      const r = deleteTracesBeforeStmt.run(cutoffMs);
      return { changed: Number(r.changes || 0) };
    },
    upsertBuildTask(input: {
      task_id: string;
      status: BuildTaskRow["status"];
      visibility: BuildTaskRow["visibility"];
      title: string;
      task_json: string;
      created_at: number;
      updated_at: number;
      queued_at?: number | null;
    }) {
      upsertTaskStmt.run({
        ...input,
        queued_at: input.queued_at ?? null,
      });
    },
    setBuildResult(input: {
      task_id: string;
      status: BuildTaskRow["status"];
      result_json: string;
      updated_at: number;
      error_code?: string | null;
      error_message?: string | null;
      completed_at?: number | null;
      last_error?: string | null;
      executor_target?: string | null;
      executor_id?: string | null;
    }) {
      const r = setResultStmt.run(
        input.status,
        input.result_json,
        input.updated_at,
        input.error_code ?? null,
        input.error_message ?? null,
        input.completed_at ?? null,
        input.last_error ?? null,
        input.executor_target ?? null,
        input.executor_id ?? null,
        input.task_id
      );
      return r.changes > 0;
    },
    insertTaskArtifact(input: TaskArtifactRow) {
      insertArtifactStmt.run(input);
    },
    listTaskArtifacts(task_id: string) {
      return listArtifactsStmt.all(task_id) as TaskArtifactRow[];
    },
    getTaskArtifact(id: string) {
      return getArtifactStmt.get(id) as TaskArtifactRow | undefined;
    },
    setBuildTaskSourceTrace(input: { task_id: string; source_trace_id: string }) {
      updateTaskSourceTraceStmt.run(input.source_trace_id, input.task_id);
    },
    getKbEntry(key: string) {
      return getKbEntryStmt.get(key) as KbEntryRow | undefined;
    },
    putKbEntryCas(input: {
      key: string;
      payload_json: string;
      if_match_etag?: string;
      now: string;
    }):
      | { ok: true; entry: KbEntryRow }
      | { ok: false; current: KbEntryRow | null } {
      const tx = db.transaction(() => {
        const current = getKbEntryStmt.get(input.key) as KbEntryRow | undefined;
        if (!current) {
          if (input.if_match_etag) {
            return { ok: false as const, current: null };
          }
          const version = 1;
          const etag = makeEtag(input.payload_json, version);
          const entry: KbEntryRow = {
            key: input.key,
            payload_json: input.payload_json,
            version,
            etag,
            updated_at: input.now,
            created_at: input.now,
          };
          insertKbEntryStmt.run(entry);
          return { ok: true as const, entry };
        }

        if (input.if_match_etag && input.if_match_etag !== current.etag) {
          return { ok: false as const, current };
        }

        const version = current.version + 1;
        const etag = makeEtag(input.payload_json, version);
        const entry: KbEntryRow = {
          key: input.key,
          payload_json: input.payload_json,
          version,
          etag,
          updated_at: input.now,
          created_at: current.created_at,
        };
        updateKbEntryStmt.run(entry);
        return { ok: true as const, entry };
      });

      return tx();
    },
    getWallet(user_id: string) {
      return getWalletStmt.get(user_id) as
        | { user_id: string; teleton_balance: number; bonus_points_balance: number; updated_at: string }
        | undefined;
    },
    upsertWallet(input: { user_id: string; teleton_balance: number; bonus_points_balance: number; updated_at: string }) {
      upsertWalletStmt.run(input);
    },
    insertLedger(input: {
      id: string;
      user_id: string;
      asset: string;
      delta: number;
      reason: string;
      event_id: string;
      created_at: string;
    }) {
      insertLedgerStmt.run(input);
    },
    listLedger(input: { user_id: string; limit: number }) {
      return listLedgerStmt.all(input.user_id, input.limit) as Array<{
        id: string;
        user_id: string;
        asset: string;
        delta: number;
        reason: string;
        event_id: string;
        created_at: string;
      }>;
    },
    sumLedgerForDay(input: { user_id: string; asset: string; dayIso: string }) {
      const row = sumLedgerDayStmt.get(input.user_id, input.asset, input.dayIso) as { total: number } | undefined;
      return Number(row?.total ?? 0);
    },
    insertLrlEvent(input: {
      id: string;
      type: string;
      user_id: string;
      payload_json: string;
      payload_hash: string;
      status: string;
      blocked_reason?: string | null;
      created_at: string;
    }) {
      insertLrlEventStmt.run({
        ...input,
        blocked_reason: input.blocked_reason ?? null,
      });
    },
    listQueuedLrlEvents(limit: number) {
      return listQueuedEventsStmt.all(limit) as Array<{
        id: string;
        type: string;
        user_id: string;
        payload_json: string;
        payload_hash: string;
        status: string;
        blocked_reason?: string | null;
        created_at: string;
      }>;
    },
    updateLrlEventStatus(input: {
      id: string;
      status: string;
      blocked_reason?: string | null;
      processed_at?: string | null;
    }) {
      updateEventStatusStmt.run({
        id: input.id,
        status: input.status,
        blocked_reason: input.blocked_reason ?? null,
        processed_at: input.processed_at ?? null,
      });
    },
    insertLrlRule(input: {
      id: string;
      version: number;
      enabled: number;
      event_type: string;
      award_teleton: number;
      award_bonus: number;
      daily_cap_teleton: number;
      daily_cap_bonus: number;
      conditions_json: string;
      updated_at: string;
    }) {
      insertRuleStmt.run(input);
    },
    listLrlRules() {
      return listRulesStmt.all() as Array<{
        id: string;
        version: number;
        enabled: number;
        event_type: string;
        award_teleton: number;
        award_bonus: number;
        daily_cap_teleton: number;
        daily_cap_bonus: number;
        conditions_json: string;
        updated_at: string;
      }>;
    },
    listLrlRulesByType(event_type: string) {
      return listRulesByTypeStmt.all(event_type) as Array<{
        id: string;
        version: number;
        enabled: number;
        event_type: string;
        award_teleton: number;
        award_bonus: number;
        daily_cap_teleton: number;
        daily_cap_bonus: number;
        conditions_json: string;
        updated_at: string;
      }>;
    },
    insertReviewGate(input: { review_id: string; stars: number; visibility: string; created_at: string }) {
      insertReviewGateStmt.run(input);
    },
    getLrlEvent(id: string) {
      return getLrlEventStmt.get(id) as
        | {
            id: string;
            type: string;
            user_id: string;
            payload_json: string;
            payload_hash: string;
            status: string;
            blocked_reason?: string | null;
            created_at: string;
            processed_at?: string | null;
          }
        | undefined;
    },
    getKb2KnowledgePack(business_id: string) {
      return getKb2Stmt.get(business_id) as
        | {
            business_id: string;
            version: number;
            payload_json: string;
            etag: string | null;
            updated_at: number;
          }
        | undefined;
    },

    putKb2KnowledgePack(input: {
      business_id: string;
      payload_json: string;
      expected_version?: number;
    }):
      | { ok: true; business_id: string; version: number; updated_at: number; etag: string }
      | { ok: false; current_version: number } {
      const now = Date.now();
      const etag = crypto.createHash("sha256").update(input.payload_json).digest("hex");

      const tx = db.transaction(() => {
        const curRow = getKb2VersionStmt.get(input.business_id) as
          | { version: number }
          | undefined;
        const currentVersion = curRow?.version ?? 0;

        if (typeof input.expected_version === "number") {
          if (input.expected_version !== currentVersion) {
            return { ok: false as const, current_version: currentVersion };
          }
        }

        const nextVersion = currentVersion + 1;
        upsertKb2Stmt.run({
          business_id: input.business_id,
          version: nextVersion,
          payload_json: input.payload_json,
          updated_at: now,
          etag,
        });

        return {
          ok: true as const,
          business_id: input.business_id,
          version: nextVersion,
          updated_at: now,
          etag,
        };
      });

      return tx();
    },

    listKnowledgePacks(input?: { limit?: number }) {
      const limit = Math.min(Math.max(input?.limit ?? 200, 1), 500);
      return listPacksStmt.all(limit) as Array<{
        id: string;
        title: string;
        scope: string;
        owner_id: string;
        is_active: number;
        created_at: number;
      }>;
    },

    listActiveKnowledgePacksByScope(input: { scope: string; limit?: number }) {
      const limit = Math.min(Math.max(input.limit ?? 200, 1), 500);
      return listActivePacksByScopeStmt.all(input.scope, limit) as Array<{
        id: string;
        title: string;
        scope: string;
        owner_id: string;
        is_active: number;
        created_at: number;
      }>;
    },

    createKnowledgePack(input: {
      id: string;
      title: string;
      scope: "global" | "store" | "service";
      owner_id: string;
      is_active: boolean;
      created_at: number;
    }) {
      insertPackStmt.run({
        id: input.id,
        title: input.title,
        scope: input.scope,
        owner_id: input.owner_id,
        is_active: input.is_active ? 1 : 0,
        created_at: input.created_at,
      });
      return { id: input.id };
    },

    setKnowledgePackActive(input: { id: string; is_active: boolean }) {
      const r = setPackActiveStmt.run(input.id, input.is_active ? 1 : 0);
      return { changed: Number(r.changes || 0) };
    },

    listKnowledgeDocs(input: { pack_id: string; limit?: number }) {
      const limit = Math.min(Math.max(input.limit ?? 500, 1), 1000);
      return listDocsByPackStmt.all(input.pack_id, limit) as Array<{
        id: string;
        pack_id: string;
        kind: string;
        title: string;
        body_md: string;
        updated_at: number;
      }>;
    },

    getKnowledgeDoc(input: { id: string }) {
      return getDocStmt.get(input.id) as
        | {
            id: string;
            pack_id: string;
            kind: string;
            title: string;
            body_md: string;
            updated_at: number;
          }
        | undefined;
    },

    createKnowledgeDoc(input: {
      id: string;
      pack_id: string;
      kind: string;
      title: string;
      body_md: string;
      updated_at: number;
    }) {
      insertDocStmt.run(input);
      return { id: input.id };
    },

    updateKnowledgeDoc(input: {
      id: string;
      kind?: string | null;
      title?: string | null;
      body_md?: string | null;
      updated_at: number;
    }) {
      const r = updateDocStmt.run(input);
      return { changed: Number(r.changes || 0) };
    },

    publishKnowledgeDoc(input: { doc_id: string; version_id: string; created_at: number }) {
      const doc = getDocStmt.get(input.doc_id) as
        | { id: string; body_md: string }
        | undefined;
      if (!doc) return { ok: false as const };
      insertDocVersionStmt.run({
        id: input.version_id,
        doc_id: input.doc_id,
        body_md: doc.body_md,
        created_at: input.created_at,
      });
      return { ok: true as const, id: input.version_id };
    },

    insertAgentTrace(input: {
      trace_id: string;
      mode: string;
      message: string;
      decision_json: string;
      citations_json?: string | null;
      provider?: string | null;
      model?: string | null;
      created_at: number;
      ok: 1 | 0;
    }) {
      insertAgentTraceStmt.run({
        ...input,
        citations_json: input.citations_json ?? null,
        provider: input.provider ?? null,
        model: input.model ?? null,
      });
    },
    getBuildTask(task_id: string) {
      return getTaskStmt.get(task_id) as BuildTaskRow | undefined;
    },
    listBuildTasks(input: {
      limit?: number;
      status?: BuildTaskRow["status"];
      visibility?: BuildTaskRow["visibility"];
    }) {
      const n = Math.min(Math.max(input.limit ?? 20, 1), 100);
      if (input.status && input.visibility) {
        return listTasksByStatusVisibilityStmt.all(
          input.status,
          input.visibility,
          n
        ) as Array<
          Pick<
            BuildTaskRow,
            "task_id" | "status" | "visibility" | "title" | "created_at" | "updated_at" | "heartbeat_at" | "progress"
          >
        >;
      }
      if (input.status) {
        return listTasksByStatusStmt.all(input.status, n) as Array<
          Pick<
            BuildTaskRow,
            "task_id" | "status" | "visibility" | "title" | "created_at" | "updated_at" | "heartbeat_at" | "progress"
          >
        >;
      }
      if (input.visibility) {
        return listTasksByVisibilityStmt.all(input.visibility, n) as Array<
          Pick<
            BuildTaskRow,
            "task_id" | "status" | "visibility" | "title" | "created_at" | "updated_at" | "heartbeat_at" | "progress"
          >
        >;
      }
      return listTasksStmt.all(n) as Array<
        Pick<
          BuildTaskRow,
          "task_id" | "status" | "visibility" | "title" | "created_at" | "updated_at" | "heartbeat_at" | "progress"
        >
      >;
    },
    getBuildTaskSummary(input: {
      visibility?: BuildTaskRow["visibility"];
      now: number;
      staleMs: number;
    }) {
      const vis = input.visibility ?? null;
      const rows = countsStmt.all(vis) as Array<{ status: string; c: number }>;

      const counts = { queued: 0, running: 0, done: 0, partial: 0, blocked: 0 };
      for (const r of rows) {
        if (r.status in counts) {
          (counts as any)[r.status] = Number(r.c) || 0;
        }
      }

      const cutoff = input.now - input.staleMs;
      const staleRow = staleExecutionStmt.get(vis, cutoff) as { c: number } | undefined;

      return {
        counts,
        stale_running: Number(staleRow?.c ?? 0) || 0,
      };
    },
    heartbeatBuildTask(input: {
      task_id: string;
      runner_id?: string | null;
      progress?: number | null;
      note?: string | null;
      now: number;
      started_at?: number | null;
      executor_target?: string | null;
      executor_id?: string | null;
    }) {
      const r = heartbeatStmt.run(
        input.runner_id ?? null,
        input.now,
        input.progress ?? null,
        input.note ?? null,
        input.now,
        input.started_at ?? null,
        input.executor_target ?? null,
        input.executor_id ?? null,
        input.task_id
      );
      if (r.changes <= 0) return null;
      return getHeartbeatStmt.get(input.task_id) as
        | { task_id: string; status: string; heartbeat_at: number | null; progress: number | null }
        | undefined;
    },
    sweepStaleRunning(input: {
      visibility?: BuildTaskRow["visibility"];
      now: number;
      cutoff: number;
    }) {
      const vis = input.visibility ?? null;

      // KCA-6.1: Stale Task Detection — find candidates first for proper event emission
      const staleTasks = listStaleRunningTasksStmt.all(vis, vis, input.cutoff) as Array<{
        task_id: string;
        status: string;
        heartbeat_at: number | null;
        version: number;
        task_json: string;
        retry_count: number;
      }>;

      let processed = 0;
      const redispatch_tasks: Array<{ task_id: string; task_json: string }> = [];

      for (const task of staleTasks) {
        if (vis && task /* visibility filter would need join, simplified here */) {
          // For now we accept the bulk SQL already filtered by visibility in the original flow
        }

        if (task.status === 'self_healing') {
          // KCA-6.1 behavior preserved: self_healing stale always → needs_creator
          const targetStatus = 'needs_creator';
          const eventType = 'build_task.needs_creator';

          const updateResult = this.updateBuildTaskCAS({
            task_id: task.task_id,
            expected_version: task.version,
            patch: {
              status: targetStatus as any,
              last_error: 'STALE_HEARTBEAT',
              completed_at: input.now,
            },
            now: input.now,
          });

          if (updateResult.changed > 0) {
            processed++;

            const mcEvent = createBuildTaskMissionEvent({
              event_type: eventType as any,
              task_id: task.task_id,
              status: targetStatus,
              last_error: 'STALE_HEARTBEAT',
            });

            void emitMissionControlLiveEvent({
              kind: 'approval_required',
              severity: mcEvent.severity,
              title: `BuildTask stale → needs_creator: ${task.task_id}`,
              trace_id: task.task_id,
              payload: mcEvent,
            });
            appendMissionControlPersistenceFeed(mcEvent as any);

            void deliverBuildTaskMissionEvent(mcEvent);
          }
        } else {
          // KCA-6.3b: Stale Timeout Retry Bridge
          // Timeout is a failure outcome → must pass retry policy before finalizing
          const retryCount = task.retry_count ?? 0;
          const decision = getRetryDecision({
            status: 'timed_out',
            retry_count: retryCount,
          });

          const errorMsg = 'STALE_HEARTBEAT';
          let targetStatus: string;
          let eventType: string;
          let kind: string;
          let titleSuffix: string;
          let shouldRedispatch = false;
          let newRetryCount = retryCount;

          if (decision.can_retry) {
            targetStatus = 'retrying';
            eventType = 'build_task.retrying';
            kind = 'execution_failed';
            titleSuffix = `retrying (${retryCount + 1}/${decision.max_attempts})`;
            newRetryCount = retryCount + 1;
            shouldRedispatch = true;
          } else if (decision.reason === 'retry_budget_exhausted') {
            targetStatus = 'needs_creator';
            eventType = 'build_task.needs_creator';
            kind = 'approval_required';
            titleSuffix = 'needs_creator (retries exhausted)';
          } else {
            targetStatus = 'timed_out';
            eventType = 'build_task.timed_out';
            kind = 'execution_failed';
            titleSuffix = 'timed_out';
          }

          const patch: any = {
            status: targetStatus as any,
            last_error: errorMsg,
          };
          if (targetStatus === 'retrying') {
            patch.retry_count = newRetryCount;
          } else {
            patch.completed_at = input.now;
          }
          if (targetStatus === 'needs_creator') {
            patch.needs_creator_reason = titleSuffix.includes('retries exhausted') ? 'retry_budget_exhausted' : 'stale_timeout';
            patch.decision_options = JSON.stringify(['approve_retry', 'cancel_task', 'mark_blocked']);
            patch.resume_token = crypto.randomUUID();
            patch.creator_decision_status = 'pending';
            patch.creator_decision_at = input.now;
          }

          const updateResult = this.updateBuildTaskCAS({
            task_id: task.task_id,
            expected_version: task.version,
            patch,
            now: input.now,
          });

          if (updateResult.changed > 0) {
            processed++;

            const mcEvent = createBuildTaskMissionEvent({
              event_type: eventType as any,
              task_id: task.task_id,
              status: targetStatus,
              last_error: errorMsg,
              ...(targetStatus === 'retrying' ? { retry_count: newRetryCount } : {}),
            });

            void emitMissionControlLiveEvent({
              kind: kind as any,
              severity: mcEvent.severity,
              title: `BuildTask stale → ${titleSuffix}: ${task.task_id}`,
              trace_id: task.task_id,
              payload: mcEvent,
            });
            appendMissionControlPersistenceFeed(mcEvent as any);

            void deliverBuildTaskMissionEvent(mcEvent);

            if (shouldRedispatch && task.task_json) {
              redispatch_tasks.push({
                task_id: task.task_id,
                task_json: task.task_json,
              });
            }
          }
        }
      }

      return { processed, stale_found: staleTasks.length, redispatch_tasks };
    },
    listStaleRunningTasks(input: { cutoff: number; visibility?: BuildTaskRow["visibility"] }) {
      const vis = input.visibility ?? null;
      return listStaleRunningTasksStmt.all(vis, vis, input.cutoff) as Array<{
        task_id: string;
        status: string;
        heartbeat_at: number | null;
        version: number;
        task_json: string;
        retry_count: number;
      }>;
    },
    getScheduledRetryTasks(input: { now: number }) {
      return scheduledRetryTasksStmt.all(input.now) as Array<{
        task_id: string;
        task_json: string;
      }>;
    },
    updateBuildTaskCAS(input: {
      task_id: string;
      expected_version: number;
      patch: {
        status?: BuildTaskRow["status"];
        runner_id?: string | null;
        heartbeat_at?: number | null;
        blocked_reason?: string | null;
        started_at?: number | null;
        completed_at?: number | null;
        executor_target?: string | null;
        executor_id?: string | null;
        last_error?: string | null;
        retry_count?: number;
        next_retry_at?: number | null;
        needs_creator_reason?: string | null;
        decision_options?: string | null;
        resume_token?: string | null;
        creator_decision_status?: string | null;
        creator_decision_at?: number | null;
        note?: string | null;
      };
      now: number;
    }) {
      const r = updateTaskCasStmt.run({
        task_id: input.task_id,
        expected_version: input.expected_version,
        status: input.patch.status ?? null,
        runner_id: input.patch.runner_id ?? null,
        heartbeat_at: input.patch.heartbeat_at ?? null,
        blocked_reason: input.patch.blocked_reason ?? null,
        started_at: input.patch.started_at ?? null,
        completed_at: input.patch.completed_at ?? null,
        executor_target: input.patch.executor_target ?? null,
        executor_id: input.patch.executor_id ?? null,
        last_error: input.patch.last_error ?? null,
        retry_count: input.patch.retry_count ?? null,
        next_retry_at: input.patch.next_retry_at ?? null,
        needs_creator_reason: input.patch.needs_creator_reason ?? null,
        decision_options: input.patch.decision_options ?? null,
        resume_token: input.patch.resume_token ?? null,
        creator_decision_status: input.patch.creator_decision_status ?? null,
        creator_decision_at: input.patch.creator_decision_at ?? null,
        updated_at: input.now,
      });
      return { changed: Number(r.changes || 0) };
    },
    setHeartbeatStale(input: { task_id: string; at: number; now: number }) {
      const r = setHeartbeatStaleStmt.run(input.at, input.now, input.task_id);
      return { changed: Number(r.changes || 0) };
    },
    setBuildTaskStatus(input: {
      task_id: string;
      from: "queued" | "running";
      to: "running" | "done" | "partial" | "blocked";
      now: number;
    }) {
      const r = setStatusStmt.run(input.task_id, input.to, input.now, input.from);
      return { changed: Number(r.changes || 0) };
    },
    markBuildTaskStarted(input: { task_id: string; now: number; executor_target?: string | null; executor_id?: string | null }) {
      const result = this.updateBuildTaskCAS({
        task_id: input.task_id,
        expected_version: 0,
        patch: {
          status: "running",
          started_at: input.now,
          heartbeat_at: input.now,
          executor_target: input.executor_target ?? null,
          executor_id: input.executor_id ?? null,
        },
        now: input.now,
      });

      if (result.changed > 0) {
        const mcEvent = createBuildTaskMissionEvent({
          event_type: "build_task.started",
          task_id: input.task_id,
          status: "running",
          executor_target: input.executor_target ?? undefined,
          executor_id: input.executor_id ?? undefined,
        });

        void emitMissionControlLiveEvent({
          kind: "execution_started",
          severity: mcEvent.severity,
          title: `BuildTask started: ${input.task_id}`,
          trace_id: input.task_id,
          payload: mcEvent,
        });
        appendMissionControlPersistenceFeed(mcEvent as any);

        void deliverBuildTaskMissionEvent(mcEvent);
      }

      return result;
    },
    markBuildTaskHeartbeat(input: { task_id: string; now: number; runner_id?: string | null; progress?: number | null; note?: string | null }) {
      const result = this.heartbeatBuildTask({
        task_id: input.task_id,
        runner_id: input.runner_id ?? null,
        progress: input.progress ?? null,
        note: input.note ?? null,
        now: input.now,
      });

      if (result) {
        const mcEvent = createBuildTaskMissionEvent({
          event_type: "build_task.heartbeat",
          task_id: input.task_id,
          status: "running",
        });

        void emitMissionControlLiveEvent({
          kind: "attention_queued",
          severity: mcEvent.severity,
          title: `BuildTask heartbeat: ${input.task_id}`,
          trace_id: input.task_id,
          payload: mcEvent,
        });
        appendMissionControlPersistenceFeed(mcEvent as any);

        void deliverBuildTaskMissionEvent(mcEvent);
      }

      return result;
    },
    markBuildTaskCompleted(input: { task_id: string; now: number; status: BuildTaskRow["status"]; last_error?: string | null }) {
      const result = this.updateBuildTaskCAS({
        task_id: input.task_id,
        expected_version: 0,
        patch: {
          status: input.status,
          completed_at: input.now,
          last_error: input.last_error ?? null,
        },
        now: input.now,
      });

      if (result.changed > 0) {
        const mcEvent = createBuildTaskMissionEvent({
          event_type: "build_task.completed",
          task_id: input.task_id,
          status: input.status,
          last_error: input.last_error ?? undefined,
        });

        void emitMissionControlLiveEvent({
          kind: "execution_completed",
          severity: mcEvent.severity,
          title: `BuildTask completed: ${input.task_id}`,
          trace_id: input.task_id,
          payload: mcEvent,
        });
        appendMissionControlPersistenceFeed(mcEvent as any);

        void deliverBuildTaskMissionEvent(mcEvent);
      }

      return result;
    },
    markBuildTaskFailed(input: { task_id: string; now: number; last_error?: string | null }) {
      const result = this.updateBuildTaskCAS({
        task_id: input.task_id,
        expected_version: 0,
        patch: {
          status: "failed",
          completed_at: input.now,
          last_error: input.last_error ?? null,
        },
        now: input.now,
      });

      if (result.changed > 0) {
        const mcEvent = createBuildTaskMissionEvent({
          event_type: "build_task.failed",
          task_id: input.task_id,
          status: "failed",
          last_error: input.last_error ?? undefined,
        });

        void emitMissionControlLiveEvent({
          kind: "execution_failed",
          severity: mcEvent.severity,
          title: `BuildTask failed: ${input.task_id}`,
          trace_id: input.task_id,
          payload: mcEvent,
        });
        appendMissionControlPersistenceFeed(mcEvent as any);

        void deliverBuildTaskMissionEvent(mcEvent);
      }

      return result;
    },
  };
}
