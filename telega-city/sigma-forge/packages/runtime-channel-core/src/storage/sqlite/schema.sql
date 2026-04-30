CREATE TABLE IF NOT EXISTS runtime_channel_bindings (
  binding_id TEXT PRIMARY KEY,
  tele_user_id TEXT NOT NULL,
  transport TEXT NOT NULL,
  transport_user_id TEXT,
  transport_chat_id TEXT,
  transport_session_ref TEXT,
  workspace_id TEXT,
  is_primary INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runtime_replay_states (
  replay_id TEXT PRIMARY KEY,
  tele_user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  task_id TEXT,
  last_transport TEXT,
  last_event_ref TEXT,
  last_message_ref TEXT,
  continuity_summary TEXT,
  recovery_hint TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runtime_transport_events (
  event_id TEXT PRIMARY KEY,
  tele_user_id TEXT NOT NULL,
  session_id TEXT,
  transport TEXT NOT NULL,
  direction TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runtime_failover_audit (
  audit_id TEXT PRIMARY KEY,
  tele_user_id TEXT NOT NULL,
  session_id TEXT,
  from_transport TEXT NOT NULL,
  to_transport TEXT,
  replay_required INTEGER NOT NULL,
  reasons_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
