-- Forge Bridge Hardening v1.0 — Canonical SQL Migration
--
-- This migration creates the forge_bridge_bundles and forge_bridge_bundle_events tables.
-- It is compatible with both SQLite (current runtime) and PostgreSQL (future production).
--
-- For SQLite: the store.ts creates these tables automatically via CREATE TABLE IF NOT EXISTS.
-- For PostgreSQL: run this migration separately.
--
-- Migration: 001_forge_bridge_bundles.sql

CREATE TABLE IF NOT EXISTS forge_bridge_bundles (
  bundle_id       TEXT PRIMARY KEY,
  artifact_id     TEXT NOT NULL,
  execution_id    TEXT,
  trace_id        TEXT,
  source          TEXT NOT NULL,           -- ForgeBundleSource
  status          TEXT NOT NULL,           -- ForgeBridgeBundleStatus
  next_step       TEXT NOT NULL,           -- ForgeBundleNextStep
  artifact_type   TEXT NOT NULL,
  intent_class    TEXT NOT NULL,
  title           TEXT NOT NULL,
  summary         TEXT NOT NULL,
  payload_ref     TEXT,
  payload_inline  TEXT,                    -- JSON
  provenance_json TEXT NOT NULL,           -- ForgeBundleProvenance as JSON
  review_json     TEXT NOT NULL,           -- ForgeBundleReviewState as JSON
  persona_json    TEXT NOT NULL,           -- ForgeBundlePersonaContext as JSON
  language_json   TEXT NOT NULL,           -- ForgeBundleLanguageContext as JSON
  created_at      TEXT NOT NULL,           -- ISO 8601
  updated_at      TEXT NOT NULL            -- ISO 8601
);

CREATE INDEX IF NOT EXISTS idx_forge_bundles_artifact
  ON forge_bridge_bundles (artifact_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_forge_bundles_status
  ON forge_bridge_bundles (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_forge_bundles_updated
  ON forge_bridge_bundles (updated_at DESC);

CREATE TABLE IF NOT EXISTS forge_bridge_bundle_events (
  event_id    TEXT PRIMARY KEY,
  bundle_id   TEXT NOT NULL,
  event_type  TEXT NOT NULL,            -- ForgeBridgeBundleEventType
  payload_json TEXT,                    -- event-specific payload as JSON
  actor_id    TEXT,
  actor_role  TEXT,
  created_at  TEXT NOT NULL,            -- ISO 8601
  FOREIGN KEY(bundle_id) REFERENCES forge_bridge_bundles(bundle_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_forge_events_bundle
  ON forge_bridge_bundle_events (bundle_id, created_at DESC);
