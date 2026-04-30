CREATE TABLE IF NOT EXISTS hitl_handoffs (
  handoff_id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  run_id TEXT,
  action_id TEXT,
  department_id TEXT,
  handoff_type TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  summary TEXT NOT NULL,
  requested_decision TEXT NOT NULL,
  options_json TEXT,
  recommended_option TEXT,
  paused_stage TEXT NOT NULL,
  paused_at TEXT NOT NULL,
  decision_ttl_at TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hitl_decisions (
  decision_id TEXT PRIMARY KEY,
  handoff_id TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  selected_option TEXT,
  input_payload_json TEXT,
  note TEXT,
  decided_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hitl_resume_events (
  resume_id TEXT PRIMARY KEY,
  handoff_id TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  run_id TEXT,
  resume_mode TEXT NOT NULL,
  resume_payload_json TEXT,
  resumed_by TEXT NOT NULL,
  resumed_at TEXT NOT NULL,
  result_status TEXT NOT NULL,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS hitl_audit (
  audit_id TEXT PRIMARY KEY,
  handoff_id TEXT,
  mission_id TEXT,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  timestamp TEXT NOT NULL
);
