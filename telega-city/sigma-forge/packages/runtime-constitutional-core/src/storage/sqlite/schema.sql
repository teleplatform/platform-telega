CREATE TABLE IF NOT EXISTS constitutional_principles (
  principle_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  precedence_level INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS doctrine_registry (
  doctrine_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  doctrine_type TEXT NOT NULL,
  linked_principle_ids_json TEXT NOT NULL,
  linked_artifacts_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS institutional_memory (
  memory_id TEXT PRIMARY KEY,
  memory_type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  linked_principle_ids_json TEXT NOT NULL,
  linked_doctrine_ids_json TEXT NOT NULL,
  source_refs_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS governance_precedence_rules (
  rule_id TEXT PRIMARY KEY,
  higher_type TEXT NOT NULL,
  lower_type TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS constitutional_change_proposals (
  change_id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT,
  change_type TEXT NOT NULL,
  rationale TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS doctrine_conflicts (
  conflict_id TEXT PRIMARY KEY,
  entity_a_type TEXT NOT NULL,
  entity_a_id TEXT NOT NULL,
  entity_b_type TEXT NOT NULL,
  entity_b_id TEXT NOT NULL,
  conflict_description TEXT NOT NULL,
  resolution TEXT NOT NULL,
  winner_id TEXT NOT NULL,
  resolved_at TEXT NOT NULL,
  resolved_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS constitutional_activations (
  activation_id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  activated_at TEXT NOT NULL,
  activated_by TEXT NOT NULL,
  reason TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS constitutional_rollbacks (
  rollback_id TEXT PRIMARY KEY,
  change_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  rolled_back_at TEXT NOT NULL,
  rolled_back_by TEXT NOT NULL,
  reason TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS constitutional_audit (
  audit_id TEXT PRIMARY KEY,
  entity_type TEXT,
  entity_id TEXT,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  details_json TEXT NOT NULL,
  timestamp TEXT NOT NULL
);
