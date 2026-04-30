CREATE TABLE IF NOT EXISTS fsgr_runs (
  run_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_mode TEXT NOT NULL,
  status TEXT NOT NULL,
  graph_id TEXT NOT NULL,
  plan_mode TEXT NOT NULL,
  trace_id TEXT,
  resume_token TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fsgr_nodes (
  node_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  dependency_ids_json TEXT NOT NULL,
  input_refs_json TEXT NOT NULL,
  output_refs_json TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 0,
  fallback_skill_id TEXT,
  risk_class TEXT NOT NULL,
  validator_hooks_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES fsgr_runs(run_id)
);

CREATE TABLE IF NOT EXISTS fsgr_artifacts (
  artifact_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  node_id TEXT,
  artifact_kind TEXT NOT NULL,
  title TEXT NOT NULL,
  storage_ref TEXT NOT NULL,
  checksum TEXT,
  validator_results_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES fsgr_runs(run_id)
);

CREATE TABLE IF NOT EXISTS fsgr_capsules (
  capsule_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  capsule_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES fsgr_runs(run_id)
);

CREATE TABLE IF NOT EXISTS fsgr_events (
  event_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  node_id TEXT,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES fsgr_runs(run_id)
);

CREATE TABLE IF NOT EXISTS fsgr_memories (
  memory_id TEXT PRIMARY KEY,
  layer TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  record_key TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  source_run_id TEXT,
  source_event_id TEXT,
  source_artifact_id TEXT,
  importance TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fsgr_reviews (
  review_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  node_id TEXT,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  summary TEXT NOT NULL,
  findings_json TEXT NOT NULL,
  related_artifact_ids_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES fsgr_runs(run_id)
);

CREATE TABLE IF NOT EXISTS fsgr_evidence_links (
  link_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  from_kind TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_kind TEXT NOT NULL,
  to_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES fsgr_runs(run_id)
);
