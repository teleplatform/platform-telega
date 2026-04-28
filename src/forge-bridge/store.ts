// ─────────────────────────────────────────────────────────────
// FORGE BRIDGE HARDENING v1.0 — Persistence Store
//
// Uses the same SQLite pattern as the rest of the codebase.
// Manages forge_bridge_bundles and forge_bridge_bundle_events.
// ─────────────────────────────────────────────────────────────

import type { ForgeBridgeBundle, ForgeBridgeBundleEvent } from "./types.js";

// We store bundles as JSON in a dedicated table for simplicity
// (same pattern as task_json/result_json in build_tasks)
type ForgeBundleRow = {
  bundle_id: string;
  artifact_id: string;
  execution_id: string | null;
  trace_id: string | null;
  source: string;
  status: string;
  next_step: string;
  artifact_type: string;
  intent_class: string;
  title: string;
  summary: string;
  payload_ref: string | null;
  payload_inline: string | null;
  provenance_json: string;
  review_json: string;
  persona_json: string;
  language_json: string;
  created_at: string;
  updated_at: string;
};

type ForgeBundleEventRow = {
  event_id: string;
  bundle_id: string;
  event_type: string;
  payload_json: string | null;
  actor_id: string | null;
  actor_role: string | null;
  created_at: string;
};

let _initDone = false;

function getDb() {
  // Lazy import to avoid circular deps; same pattern as db.ts
  // We use a dynamic require because this module runs in Node context
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { db } = require("@/core/db.js") as { db: { _getStore: () => any } };
  // Access the underlying sqlite store via a helper we'll add to db.ts
  // For now, we directly access the sqlite module
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sqliteModule = require("@/server/storage/sqlite.js");
  return sqliteModule;
}

// We need access to the raw db instance to create our tables.
// The cleanest approach: we create our own store manager that
// plugs into the same SQLite file.
let _rawDb: any = null;

function getRawDb() {
  if (_rawDb) return _rawDb;

  const path = require("node:path");
  const fs = require("node:fs");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Database = require("better-sqlite3");

  const dataDir = process.env.TELEGPT_DATA_DIR ?? ".data";
  const dbPath = path.join(dataDir, "tele-gpt.sqlite");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  _rawDb = new Database(dbPath);
  _rawDb.pragma("journal_mode = WAL");
  _rawDb.pragma("foreign_keys = ON");

  return _rawDb;
}

function ensureTables() {
  if (_initDone) return;
  const db = getRawDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS forge_bridge_bundles (
      bundle_id       TEXT PRIMARY KEY,
      artifact_id     TEXT NOT NULL,
      execution_id    TEXT,
      trace_id        TEXT,
      source          TEXT NOT NULL,
      status          TEXT NOT NULL,
      next_step       TEXT NOT NULL,
      artifact_type   TEXT NOT NULL,
      intent_class    TEXT NOT NULL,
      title           TEXT NOT NULL,
      summary         TEXT NOT NULL,
      payload_ref     TEXT,
      payload_inline  TEXT,
      provenance_json TEXT NOT NULL,
      review_json     TEXT NOT NULL,
      persona_json    TEXT NOT NULL,
      language_json  TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_forge_bundles_artifact
    ON forge_bridge_bundles (artifact_id, created_at DESC);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_forge_bundles_status
    ON forge_bridge_bundles (status, created_at DESC);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_forge_bundles_updated
    ON forge_bridge_bundles (updated_at DESC);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS forge_bridge_bundle_events (
      event_id    TEXT PRIMARY KEY,
      bundle_id   TEXT NOT NULL,
      event_type  TEXT NOT NULL,
      payload_json TEXT,
      actor_id    TEXT,
      actor_role  TEXT,
      created_at  TEXT NOT NULL,
      FOREIGN KEY(bundle_id) REFERENCES forge_bridge_bundles(bundle_id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_forge_events_bundle
    ON forge_bridge_bundle_events (bundle_id, created_at DESC);
  `);

  _initDone = true;
}

// -- Prepared statements (lazy) --
let _stmts: ReturnType<typeof _prepareStmts> | null = null;

function _prepareStmts() {
  const db = getRawDb();

  const insertBundle = db.prepare(`
    INSERT INTO forge_bridge_bundles (
      bundle_id, artifact_id, execution_id, trace_id,
      source, status, next_step, artifact_type, intent_class,
      title, summary, payload_ref, payload_inline,
      provenance_json, review_json, persona_json, language_json,
      created_at, updated_at
    ) VALUES (
      @bundle_id, @artifact_id, @execution_id, @trace_id,
      @source, @status, @next_step, @artifact_type, @intent_class,
      @title, @summary, @payload_ref, @payload_inline,
      @provenance_json, @review_json, @persona_json, @language_json,
      @created_at, @updated_at
    );
  `);

  const getBundle = db.prepare(`
    SELECT * FROM forge_bridge_bundles WHERE bundle_id = ?;
  `);

  const updateBundle = db.prepare(`
    UPDATE forge_bridge_bundles
    SET status = @status,
        next_step = @next_step,
        review_json = @review_json,
        payload_ref = COALESCE(@payload_ref, payload_ref),
        updated_at = @updated_at
    WHERE bundle_id = @bundle_id;
  `);

  const listRecent = db.prepare(`
    SELECT * FROM forge_bridge_bundles
    ORDER BY updated_at DESC
    LIMIT ?;
  `);

  const listByArtifact = db.prepare(`
    SELECT * FROM forge_bridge_bundles
    WHERE artifact_id = ?
    ORDER BY created_at DESC;
  `);

  const insertEvent = db.prepare(`
    INSERT INTO forge_bridge_bundle_events (
      event_id, bundle_id, event_type, payload_json, actor_id, actor_role, created_at
    ) VALUES (
      @event_id, @bundle_id, @event_type, @payload_json, @actor_id, @actor_role, @created_at
    );
  `);

  const listEvents = db.prepare(`
    SELECT * FROM forge_bridge_bundle_events
    WHERE bundle_id = ?
    ORDER BY created_at ASC;
  `);

  const findDuplicate = db.prepare(`
    SELECT bundle_id FROM forge_bridge_bundles
    WHERE artifact_id = ?
      AND COALESCE(execution_id, '') = COALESCE(?, '')
      AND status NOT IN ('blocked', 'transferred')
    ORDER BY created_at DESC
    LIMIT 1;
  `);

  return {
    insertBundle,
    getBundle,
    updateBundle,
    listRecent,
    listByArtifact,
    insertEvent,
    listEvents,
    findDuplicate,
  };
}

function stmts() {
  ensureTables();
  if (!_stmts) _stmts = _prepareStmts();
  return _stmts;
}

// -- Public store API --

export function insertBundle(bundle: ForgeBridgeBundle): void {
  const s = stmts();
  s.insertBundle.run({
    bundle_id: bundle.bundleId,
    artifact_id: bundle.artifactId,
    execution_id: bundle.executionId ?? null,
    trace_id: bundle.traceId ?? null,
    source: bundle.source,
    status: bundle.status,
    next_step: bundle.nextStep,
    artifact_type: bundle.artifactType,
    intent_class: bundle.intentClass,
    title: bundle.title,
    summary: bundle.summary,
    payload_ref: bundle.payloadRef ?? null,
    payload_inline: bundle.payloadInline ? JSON.stringify(bundle.payloadInline) : null,
    provenance_json: JSON.stringify(bundle.provenance),
    review_json: JSON.stringify(bundle.review),
    persona_json: JSON.stringify(bundle.persona),
    language_json: JSON.stringify(bundle.language),
    created_at: bundle.createdAt,
    updated_at: bundle.updatedAt,
  });
}

export function getBundle(bundleId: string): ForgeBridgeBundle | undefined {
  const s = stmts();
  const row = s.getBundle.get(bundleId) as ForgeBundleRow | undefined;
  if (!row) return undefined;
  return rowToBundle(row);
}

export function updateBundle(bundle: ForgeBridgeBundle): void {
  const s = stmts();
  s.updateBundle.run({
    bundle_id: bundle.bundleId,
    status: bundle.status,
    next_step: bundle.nextStep,
    review_json: JSON.stringify(bundle.review),
    payload_ref: bundle.payloadRef ?? null,
    updated_at: bundle.updatedAt,
  });
}

export function listRecent(limit = 20): ForgeBridgeBundle[] {
  const s = stmts();
  const rows = s.listRecent.all(Math.min(Math.max(limit, 1), 100)) as ForgeBundleRow[];
  return rows.map(rowToBundle);
}

export function listByArtifact(artifactId: string): ForgeBridgeBundle[] {
  const s = stmts();
  const rows = s.listByArtifact.all(artifactId) as ForgeBundleRow[];
  return rows.map(rowToBundle);
}

export function insertEvent(event: ForgeBridgeBundleEvent): void {
  const s = stmts();
  s.insertEvent.run({
    event_id: event.eventId,
    bundle_id: event.bundleId,
    event_type: event.eventType,
    payload_json: event.payload ? JSON.stringify(event.payload) : null,
    actor_id: event.actorId ?? null,
    actor_role: event.actorRole ?? null,
    created_at: event.createdAt,
  });
}

export function listEvents(bundleId: string): ForgeBridgeBundleEvent[] {
  const s = stmts();
  const rows = s.listEvents.all(bundleId) as ForgeBundleEventRow[];
  return rows.map(rowToEvent);
}

export function findExistingBundle(
  artifactId: string,
  executionId: string | undefined,
): string | undefined {
  const s = stmts();
  const row = s.findDuplicate.get(artifactId, executionId ?? "") as { bundle_id: string } | undefined;
  return row?.bundle_id;
}

function rowToBundle(row: ForgeBundleRow): ForgeBridgeBundle {
  return {
    bundleId: row.bundle_id,
    artifactId: row.artifact_id,
    executionId: row.execution_id ?? undefined,
    traceId: row.trace_id ?? undefined,
    source: row.source as ForgeBridgeBundle["source"],
    status: row.status as ForgeBridgeBundle["status"],
    nextStep: row.next_step as ForgeBridgeBundle["nextStep"],
    artifactType: row.artifact_type,
    intentClass: row.intent_class,
    title: row.title,
    summary: row.summary,
    payloadRef: row.payload_ref ?? undefined,
    payloadInline: row.payload_inline ? JSON.parse(row.payload_inline) : undefined,
    provenance: JSON.parse(row.provenance_json),
    review: JSON.parse(row.review_json),
    persona: JSON.parse(row.persona_json),
    language: JSON.parse(row.language_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToEvent(row: ForgeBundleEventRow): ForgeBridgeBundleEvent {
  return {
    eventId: row.event_id,
    bundleId: row.bundle_id,
    eventType: row.event_type as ForgeBridgeBundleEvent["eventType"],
    payload: row.payload_json ? JSON.parse(row.payload_json) : undefined,
    actorId: row.actor_id ?? undefined,
    actorRole: row.actor_role ?? undefined,
    createdAt: row.created_at,
  };
}
