CREATE TABLE IF NOT EXISTS control_surfaces (
  surface_id TEXT PRIMARY KEY,
  surface_type TEXT NOT NULL,
  title TEXT NOT NULL,
  allowed_views_json TEXT NOT NULL,
  allowed_actions_json TEXT NOT NULL,
  required_role_map_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS human_governance_actions (
  action_id TEXT PRIMARY KEY,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  mode TEXT NOT NULL,
  risk_class TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS legibility_digests (
  digest_id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL,
  active_constraints_json TEXT NOT NULL,
  pending_actions_json TEXT NOT NULL,
  risk_flags_json TEXT NOT NULL,
  generated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS truth_views (
  view_id TEXT PRIMARY KEY,
  view_type TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  state_summary TEXT NOT NULL,
  provenance_refs_json TEXT NOT NULL,
  active_constraints_json TEXT NOT NULL,
  recent_decisions_json TEXT NOT NULL,
  generated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS guarded_action_policies (
  policy_id TEXT PRIMARY KEY,
  action_type TEXT NOT NULL,
  required_roles_json TEXT NOT NULL,
  confirmation_mode TEXT NOT NULL,
  blocked_if_constraints_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS decision_digests (
  digest_id TEXT PRIMARY KEY,
  digest_type TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  what_changed_json TEXT NOT NULL,
  what_blocked_json TEXT NOT NULL,
  next_actions_json TEXT NOT NULL,
  what_not_to_touch_json TEXT NOT NULL,
  trace_refs_json TEXT NOT NULL,
  generated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operator_interventions (
  intervention_id TEXT PRIMARY KEY,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  risk_class TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS control_audit (
  audit_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details_json TEXT NOT NULL,
  timestamp TEXT NOT NULL
);
