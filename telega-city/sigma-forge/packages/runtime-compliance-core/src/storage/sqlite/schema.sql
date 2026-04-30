CREATE TABLE IF NOT EXISTS compliance_decisions (
  decision_id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL,
  mission_id TEXT,
  run_id TEXT,
  verdict TEXT NOT NULL,
  severity TEXT NOT NULL,
  requires_human_approval INTEGER NOT NULL,
  approval_reason TEXT,
  policy_refs_json TEXT NOT NULL,
  reason_codes_json TEXT NOT NULL,
  explanation TEXT NOT NULL,
  decided_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS compliance_events (
  audit_id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL,
  mission_id TEXT,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  details_json TEXT NOT NULL,
  timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approval_requests (
  request_id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL,
  mission_id TEXT,
  required_decision TEXT NOT NULL,
  recommended_option TEXT,
  status TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  resolved_at TEXT,
  resolved_by TEXT,
  decision_value TEXT
);
