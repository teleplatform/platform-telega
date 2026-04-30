CREATE TABLE IF NOT EXISTS runtime_route_decisions (
  decision_id TEXT PRIMARY KEY,
  task_id TEXT,
  execution_mode TEXT NOT NULL,
  complexity TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  latency_sensitivity TEXT NOT NULL,
  privacy_sensitivity TEXT NOT NULL,
  estimated_token_volume TEXT NOT NULL,
  needs_tools INTEGER NOT NULL,
  needs_review INTEGER NOT NULL,
  reasons_json TEXT NOT NULL,
  cheaper_mode_available TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runtime_provider_selections (
  selection_id TEXT PRIMARY KEY,
  task_id TEXT,
  selected_provider_id TEXT NOT NULL,
  selected_provider_type TEXT NOT NULL,
  rejected_json TEXT NOT NULL,
  reasons_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runtime_budget_events (
  event_id TEXT PRIMARY KEY,
  task_id TEXT,
  allowed INTEGER NOT NULL,
  reasons_json TEXT NOT NULL,
  estimated_cost REAL,
  estimated_tokens INTEGER,
  cheaper_mode_recommended TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runtime_cost_signals (
  signal_id TEXT PRIMARY KEY,
  task_id TEXT,
  complexity TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  latency_sensitivity TEXT NOT NULL,
  privacy_sensitivity TEXT NOT NULL,
  estimated_token_volume TEXT NOT NULL,
  needs_tools INTEGER NOT NULL,
  needs_review INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
