CREATE TABLE IF NOT EXISTS optimization_candidates (
  candidate_id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  intent_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  proposed_params_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS optimization_trials (
  trial_id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  scope_percentage REAL NOT NULL,
  scope_segment TEXT,
  duration_ms INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  status TEXT NOT NULL,
  FOREIGN KEY (candidate_id) REFERENCES optimization_candidates(candidate_id)
);

CREATE TABLE IF NOT EXISTS optimization_metrics (
  metric_id TEXT PRIMARY KEY,
  trial_id TEXT NOT NULL,
  baseline_json TEXT NOT NULL,
  candidate_json TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  FOREIGN KEY (trial_id) REFERENCES optimization_trials(trial_id)
);

CREATE TABLE IF NOT EXISTS optimization_evaluations (
  evaluation_id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  trial_id TEXT NOT NULL,
  improvement INTEGER NOT NULL,
  regression INTEGER NOT NULL,
  metrics_diff_json TEXT NOT NULL,
  decision TEXT NOT NULL,
  evaluated_at TEXT NOT NULL,
  FOREIGN KEY (candidate_id) REFERENCES optimization_candidates(candidate_id),
  FOREIGN KEY (trial_id) REFERENCES optimization_trials(trial_id)
);

CREATE TABLE IF NOT EXISTS optimization_rollouts (
  rollout_id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  started_at TEXT NOT NULL,
  status TEXT NOT NULL,
  FOREIGN KEY (candidate_id) REFERENCES optimization_candidates(candidate_id)
);

CREATE TABLE IF NOT EXISTS optimization_rollbacks (
  rollback_id TEXT PRIMARY KEY,
  rollout_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (rollout_id) REFERENCES optimization_rollouts(rollout_id),
  FOREIGN KEY (candidate_id) REFERENCES optimization_candidates(candidate_id)
);
