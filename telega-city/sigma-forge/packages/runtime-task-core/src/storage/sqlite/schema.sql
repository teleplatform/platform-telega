CREATE TABLE IF NOT EXISTS runtime_async_tasks (
  task_id TEXT PRIMARY KEY,
  tele_user_id TEXT NOT NULL,
  workspace_id TEXT,
  session_id TEXT,
  run_id TEXT,
  goal TEXT NOT NULL,
  task_class TEXT,
  status TEXT NOT NULL,
  execution_mode TEXT,
  risk_level TEXT NOT NULL,
  budget_estimate REAL,
  delivery_targets_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runtime_handoffs (
  handoff_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  run_id TEXT,
  summary TEXT NOT NULL,
  completed_steps_json TEXT NOT NULL,
  blocked_reason TEXT,
  recommended_action TEXT,
  draft_output TEXT,
  required_human_input_json TEXT,
  risk_flags_json TEXT,
  rejected_options_json TEXT,
  reason_code TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runtime_human_decisions (
  decision_id TEXT PRIMARY KEY,
  handoff_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  action TEXT NOT NULL,
  editor_notes TEXT,
  replacement_output TEXT,
  reroute_target TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runtime_task_deliveries (
  delivery_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  tele_user_id TEXT NOT NULL,
  target TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_summary TEXT NOT NULL,
  payload_ref TEXT,
  created_at TEXT NOT NULL
);
