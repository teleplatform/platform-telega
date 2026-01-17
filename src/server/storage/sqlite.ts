import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { ApiErrorCode } from "../../types/api.ts";

export type AskTrace = {
  trace_id: string;
  message: string;
  reply: string;
  mode: "echo" | "openai";
  provider: "local" | "openai";
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
};

export type HistoryQuery = {
  user_id?: string;
  limit?: number;
};

export type BuildTaskRow = {
  task_id: string;
  status: "queued" | "running" | "done" | "partial" | "blocked";
  visibility: "public" | "creator" | "core";
  title: string;
  created_at: number;
  updated_at: number;
  task_json: string;
  result_json?: string | null;
  error_code?: string | null;
  error_message?: string | null;
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
    CREATE INDEX IF NOT EXISTS idx_build_tasks_updated
    ON build_tasks (updated_at DESC);
  `);

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

  const insertStmt = db.prepare(`
    INSERT INTO ask_traces (
      trace_id, message, reply, mode, provider, model, user_id, created_at,
      ok, duration_ms, latency_ms, request_bytes, reply_bytes, tokens_in, tokens_out,
      cost_usd, error_code, error_message
    ) VALUES (
      @trace_id, @message, @reply, @mode, @provider, @model, @user_id, @created_at,
      @ok, @duration_ms, @latency_ms, @request_bytes, @reply_bytes, @tokens_in,
      @tokens_out, @cost_usd, @error_code, @error_message
    )
  `);

  const getStmt = db.prepare(`
    SELECT trace_id, message, reply, mode, provider, model, user_id, created_at,
           ok, duration_ms, latency_ms, request_bytes, reply_bytes, tokens_in,
           tokens_out, cost_usd, error_code, error_message
    FROM ask_traces
    WHERE trace_id = ?
  `);

  const listAllStmt = db.prepare(`
    SELECT trace_id, message, reply, mode, provider, model, user_id, created_at,
           ok, duration_ms, latency_ms, request_bytes, reply_bytes, tokens_in,
           tokens_out, cost_usd, error_code, error_message
    FROM ask_traces
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const listUserStmt = db.prepare(`
    SELECT trace_id, message, reply, mode, provider, model, user_id, created_at,
           ok, duration_ms, latency_ms, request_bytes, reply_bytes, tokens_in,
           tokens_out, cost_usd, error_code, error_message
    FROM ask_traces
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const upsertTaskStmt = db.prepare(`
    INSERT INTO build_tasks (
      task_id, status, visibility, title, created_at, updated_at, task_json
    ) VALUES (
      @task_id, @status, @visibility, @title, @created_at, @updated_at, @task_json
    )
    ON CONFLICT(task_id) DO UPDATE SET
      visibility = excluded.visibility,
      title = excluded.title,
      task_json = excluded.task_json,
      updated_at = excluded.updated_at
  `);

  const setResultStmt = db.prepare(`
    UPDATE build_tasks
    SET status = ?, result_json = ?, updated_at = ?, error_code = ?, error_message = ?
    WHERE task_id = ?
  `);

  const getTaskStmt = db.prepare(`
    SELECT task_id, status, visibility, title, created_at, updated_at, task_json,
           result_json, error_code, error_message
    FROM build_tasks
    WHERE task_id = ?
  `);

  const listTasksStmt = db.prepare(`
    SELECT task_id, status, visibility, title, created_at, updated_at
    FROM build_tasks
    ORDER BY updated_at DESC
    LIMIT ?
  `);

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
    upsertBuildTask(input: {
      task_id: string;
      status: BuildTaskRow["status"];
      visibility: BuildTaskRow["visibility"];
      title: string;
      task_json: string;
      created_at: number;
      updated_at: number;
    }) {
      upsertTaskStmt.run(input);
    },
    setBuildResult(input: {
      task_id: string;
      status: BuildTaskRow["status"];
      result_json: string;
      updated_at: number;
      error_code?: string | null;
      error_message?: string | null;
    }) {
      const r = setResultStmt.run(
        input.status,
        input.result_json,
        input.updated_at,
        input.error_code ?? null,
        input.error_message ?? null,
        input.task_id
      );
      return r.changes > 0;
    },
    getBuildTask(task_id: string) {
      return getTaskStmt.get(task_id) as BuildTaskRow | undefined;
    },
    listBuildTasks(limit?: number) {
      const n = Math.min(Math.max(limit ?? 20, 1), 100);
      return listTasksStmt.all(n) as Array<
        Pick<BuildTaskRow, "task_id" | "status" | "visibility" | "title" | "created_at" | "updated_at">
      >;
    },
  };
}
