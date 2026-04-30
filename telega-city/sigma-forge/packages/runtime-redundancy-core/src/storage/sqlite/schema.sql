CREATE TABLE IF NOT EXISTS transport_channels (
  channel_id TEXT PRIMARY KEY,
  transport TEXT NOT NULL,
  identity_key TEXT NOT NULL,
  status TEXT NOT NULL,
  priority INTEGER NOT NULL,
  last_heartbeat_at TEXT,
  last_failure_at TEXT,
  failure_reason TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS identity_continuity (
  identity_id TEXT PRIMARY KEY,
  transport_identity_key TEXT NOT NULL,
  transport TEXT NOT NULL,
  canonical_user_id TEXT NOT NULL,
  session_id TEXT,
  bound_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS failover_events (
  failover_id TEXT PRIMARY KEY,
  mission_id TEXT,
  session_id TEXT,
  from_transport TEXT NOT NULL,
  to_transport TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  result TEXT
);

CREATE TABLE IF NOT EXISTS recovery_records (
  recovery_id TEXT PRIMARY KEY,
  mission_id TEXT,
  session_id TEXT,
  transport TEXT NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  result_summary TEXT,
  evidence_refs_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS delivery_envelopes (
  delivery_id TEXT PRIMARY KEY,
  mission_id TEXT,
  target_transport TEXT NOT NULL,
  fallback_transport TEXT,
  payload_ref TEXT NOT NULL,
  payload_summary TEXT NOT NULL,
  status TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transport_loss_events (
  event_id TEXT PRIMARY KEY,
  transport TEXT NOT NULL,
  severity TEXT NOT NULL,
  reason TEXT NOT NULL,
  affected_missions_json TEXT NOT NULL,
  detected_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operational_degradation_states (
  degradation_id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  active_transport TEXT NOT NULL,
  lost_transports_json TEXT NOT NULL,
  degradation_mode TEXT NOT NULL,
  affected_operations_json TEXT NOT NULL,
  activated_at TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS redundancy_audit (
  audit_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  transport TEXT,
  details_json TEXT NOT NULL,
  timestamp TEXT NOT NULL
);
