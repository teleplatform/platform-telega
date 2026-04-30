CREATE TABLE IF NOT EXISTS adaptation_proposals (
  proposal_id TEXT PRIMARY KEY,
  proposal_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  title TEXT NOT NULL,
  rationale TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL,
  risk_class TEXT NOT NULL,
  proposed_change_json TEXT NOT NULL,
  status TEXT NOT NULL,
  policy_outcome TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS adaptation_proposal_evidence (
  ref_id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (proposal_id) REFERENCES adaptation_proposals(proposal_id)
);

CREATE TABLE IF NOT EXISTS adaptation_reviews (
  review_id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  action TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  notes TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (proposal_id) REFERENCES adaptation_proposals(proposal_id)
);

CREATE TABLE IF NOT EXISTS adaptation_changes (
  change_id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  applied_by TEXT NOT NULL,
  before_snapshot_json TEXT NOT NULL,
  after_snapshot_json TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  FOREIGN KEY (proposal_id) REFERENCES adaptation_proposals(proposal_id)
);

CREATE TABLE IF NOT EXISTS adaptation_rollbacks (
  rollback_id TEXT PRIMARY KEY,
  change_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  rolled_back_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  rolled_back_at TEXT NOT NULL,
  FOREIGN KEY (change_id) REFERENCES adaptation_changes(change_id),
  FOREIGN KEY (proposal_id) REFERENCES adaptation_proposals(proposal_id)
);
