CREATE TABLE IF NOT EXISTS crisis_events (
  crisis_id TEXT PRIMARY KEY,
  crisis_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  affected_scope TEXT NOT NULL,
  affected_ids_json TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  detected_by TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS continuity_modes (
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  current_mode TEXT NOT NULL,
  activated_at TEXT NOT NULL,
  activated_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  PRIMARY KEY (scope_type, scope_id)
);

CREATE TABLE IF NOT EXISTS sovereign_fallback_profiles (
  profile_id TEXT PRIMARY KEY,
  scope_id TEXT NOT NULL,
  surviving_capabilities_json TEXT NOT NULL,
  excluded_dependencies_json TEXT NOT NULL,
  local_policy_baseline TEXT NOT NULL,
  execution_classes_active_json TEXT NOT NULL,
  execution_classes_frozen_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS crisis_approval_rules (
  rule_id TEXT PRIMARY KEY,
  action_type TEXT NOT NULL,
  required_roles_json TEXT NOT NULL,
  scope TEXT NOT NULL,
  severity_threshold TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recovery_attempts (
  recovery_id TEXT PRIMARY KEY,
  crisis_id TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  status TEXT NOT NULL,
  rollback_reason TEXT,
  FOREIGN KEY (crisis_id) REFERENCES crisis_events(crisis_id)
);

CREATE TABLE IF NOT EXISTS resilience_audit (
  audit_id TEXT PRIMARY KEY,
  crisis_id TEXT,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  details_json TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (crisis_id) REFERENCES crisis_events(crisis_id)
);

CREATE TABLE IF NOT EXISTS crisis_simulations (
  simulation_id TEXT PRIMARY KEY,
  scenario_type TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  continuity_feasible INTEGER NOT NULL,
  surviving_capabilities_json TEXT NOT NULL,
  policy_breach_risks_json TEXT NOT NULL,
  recovery_ready INTEGER NOT NULL,
  audit_survivable INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
