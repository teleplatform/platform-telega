CREATE TABLE IF NOT EXISTS cost_profiles (
  profile_id TEXT PRIMARY KEY,
  mission_type TEXT NOT NULL,
  department_id TEXT,
  max_auto_cost_usd REAL NOT NULL,
  confirmation_cost_usd REAL NOT NULL,
  hard_cap_cost_usd REAL NOT NULL,
  max_orchestration_depth INTEGER NOT NULL,
  require_confirmation_if_user_visible INTEGER NOT NULL DEFAULT 0,
  default_business_value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS branch_cost_estimates (
  estimate_id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  run_id TEXT,
  route_key TEXT,
  estimated_cost_usd REAL NOT NULL,
  estimated_tokens_in INTEGER,
  estimated_tokens_out INTEGER,
  estimated_tool_calls INTEGER,
  orchestration_depth INTEGER NOT NULL,
  estimated_latency_ms INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cost_decisions (
  decision_id TEXT PRIMARY KEY,
  cost_eval_id TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  run_id TEXT,
  verdict TEXT NOT NULL,
  severity TEXT NOT NULL,
  reason_codes_json TEXT NOT NULL DEFAULT '[]',
  policy_refs_json TEXT NOT NULL DEFAULT '[]',
  estimated_cost_usd REAL NOT NULL,
  approved_cost_threshold_usd REAL,
  explanation TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cost_audit (
  audit_id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  run_id TEXT,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
