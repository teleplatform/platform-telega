CREATE TABLE IF NOT EXISTS feedback_events (
  event_id TEXT PRIMARY KEY,
  session_id TEXT,
  trace_id TEXT,
  user_id TEXT,
  core_user_id TEXT,
  transport TEXT,
  route_id TEXT,
  tool_id TEXT,
  event_type TEXT NOT NULL,
  outcome TEXT,
  severity TEXT,
  reason_code TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS execution_outcomes (
  outcome_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  trace_id TEXT,
  route_id TEXT,
  transport TEXT,
  outcome TEXT NOT NULL,
  reason_code TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback_aggregates (
  aggregate_id TEXT PRIMARY KEY,
  scope_kind TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  computed_at TEXT NOT NULL
);
