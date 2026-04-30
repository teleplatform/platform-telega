-- Governance Runtime Schema (X1.5)
-- Applies to SQLite via better-sqlite3
-- Migration: 001

-- ============================================================================
-- Observability Layer
-- ============================================================================

CREATE TABLE IF NOT EXISTS runtime_incident_patterns (
  pattern_id TEXT PRIMARY KEY,
  pattern_type TEXT NOT NULL,
  source_closure_ids TEXT NOT NULL,    -- JSON array
  source_trace_ids TEXT NOT NULL,      -- JSON array
  recurrence_score INTEGER NOT NULL,   -- 0..100
  severity_trend TEXT NOT NULL,        -- stable|rising|decreasing
  detected_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incident_patterns_detected
ON runtime_incident_patterns (detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_incident_patterns_type
ON runtime_incident_patterns (pattern_type, detected_at DESC);

CREATE TABLE IF NOT EXISTS runtime_performance_baselines (
  baseline_id TEXT PRIMARY KEY,
  median_latency_ms INTEGER NOT NULL,
  fallback_rate REAL NOT NULL,
  operator_intervention_rate REAL NOT NULL,
  secret_injection_success_rate REAL NOT NULL,
  route_success_rate REAL NOT NULL,
  baseline_window_ms INTEGER NOT NULL,
  status TEXT NOT NULL,                -- learning|established|outdated
  established_at INTEGER
);

-- ============================================================================
-- Governance Layer
-- ============================================================================

CREATE TABLE IF NOT EXISTS runtime_policy_learning_records (
  learning_id TEXT PRIMARY KEY,
  based_on_pattern_ids TEXT NOT NULL,  -- JSON array
  based_on_baseline_id TEXT,
  learned_adjustments TEXT NOT NULL,   -- JSON array
  confidence TEXT NOT NULL,            -- low|medium|high
  status TEXT NOT NULL,                -- proposed|validated|applied|rejected
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS operational_doctrines (
  doctrine_id TEXT PRIMARY KEY,
  doctrine_type TEXT NOT NULL,
  supporting_pattern_ids TEXT NOT NULL,  -- JSON array
  supporting_learning_ids TEXT NOT NULL, -- JSON array
  doctrine_strength INTEGER NOT NULL,    -- 0..100
  enforcement_level TEXT NOT NULL,       -- advisory|strong|mandatory
  ratified_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS operational_doctrine_conflicts (
  conflict_id TEXT PRIMARY KEY,
  doctrine_a_id TEXT NOT NULL,
  doctrine_b_id TEXT NOT NULL,
  conflict_type TEXT NOT NULL,
  detected_reason TEXT NOT NULL,
  severity TEXT NOT NULL,                -- low|medium|high|critical
  resolution_status TEXT NOT NULL,       -- pending|resolved|escalated
  detected_at INTEGER NOT NULL,
  resolved_at INTEGER
);

CREATE TABLE IF NOT EXISTS operational_judgments (
  judgment_id TEXT PRIMARY KEY,
  source_conflict_ids TEXT NOT NULL,     -- JSON array
  source_doctrine_ids TEXT NOT NULL,     -- JSON array
  judgment_type TEXT NOT NULL,
  chosen_priority TEXT NOT NULL,
  rationale TEXT NOT NULL,
  confidence TEXT NOT NULL,              -- low|medium|high
  decided_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS supreme_operational_overrides (
  override_id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  authority_source TEXT NOT NULL,        -- operator|constitutional_guard|critical_runtime_rule
  severity TEXT NOT NULL,                -- high|critical
  active INTEGER NOT NULL DEFAULT 1,
  activated_at INTEGER NOT NULL,
  released_at INTEGER
);

CREATE TABLE IF NOT EXISTS operator_state_authorities (
  authority_id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  state TEXT NOT NULL,                   -- inactive|advisory|elevated|supreme
  justification TEXT NOT NULL,
  granted_scopes TEXT NOT NULL,          -- JSON array
  activated_at INTEGER NOT NULL,
  expires_at INTEGER
);

-- ============================================================================
-- Constitutional Layer
-- ============================================================================

CREATE TABLE IF NOT EXISTS live_governance_constitutions (
  constitution_id TEXT PRIMARY KEY,
  active_doctrine_ids TEXT NOT NULL,       -- JSON array
  active_conflict_ids TEXT NOT NULL,       -- JSON array
  active_judgment_ids TEXT NOT NULL,       -- JSON array
  active_override_ids TEXT NOT NULL,       -- JSON array
  active_operator_authority_ids TEXT NOT NULL, -- JSON array
  constitutional_state TEXT NOT NULL,      -- stable|guarded|restricted|emergency
  legitimacy_score INTEGER NOT NULL,       -- 0..100
  governance_coherence_score INTEGER NOT NULL, -- 0..100
  last_ratified_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS constitutional_legitimacy_records (
  legitimacy_id TEXT PRIMARY KEY,
  constitution_id TEXT NOT NULL,
  doctrine_coherence_score INTEGER NOT NULL,
  operator_authority_validity_score INTEGER NOT NULL,
  override_discipline_score INTEGER NOT NULL,
  audit_completeness_score INTEGER NOT NULL,
  live_governance_consistency_score INTEGER NOT NULL,
  aggregate_legitimacy_score INTEGER NOT NULL,
  legitimacy_state TEXT NOT NULL,          -- legitimate|fragile|contested|invalid
  evaluated_at INTEGER NOT NULL,
  FOREIGN KEY (constitution_id) REFERENCES live_governance_constitutions(constitution_id)
);

CREATE TABLE IF NOT EXISTS emergency_continuity_states (
  continuity_id TEXT PRIMARY KEY,
  constitution_id TEXT NOT NULL,
  trigger_reason TEXT NOT NULL,
  mode TEXT NOT NULL,                      -- safe_minimum|restricted_runtime|operator_guarded|restoration_in_progress
  suspended_capabilities TEXT NOT NULL,    -- JSON array
  preserved_capabilities TEXT NOT NULL,    -- JSON array
  restoration_target_state TEXT NOT NULL,  -- stable|guarded|restricted
  activated_at INTEGER NOT NULL,
  restored_at INTEGER,
  FOREIGN KEY (constitution_id) REFERENCES live_governance_constitutions(constitution_id)
);

CREATE TABLE IF NOT EXISTS governance_amendment_proposals (
  amendment_id TEXT PRIMARY KEY,
  constitution_id TEXT NOT NULL,
  amendment_type TEXT NOT NULL,
  title TEXT NOT NULL,
  rationale TEXT NOT NULL,
  proposed_changes TEXT NOT NULL,          -- JSON array
  evidence_refs TEXT NOT NULL,             -- JSON array
  approval_state TEXT NOT NULL,            -- draft|proposed|under_review|approved|rejected|applied
  created_at INTEGER NOT NULL,
  decided_at INTEGER,
  FOREIGN KEY (constitution_id) REFERENCES live_governance_constitutions(constitution_id)
);

CREATE TABLE IF NOT EXISTS constitutional_audit_events (
  audit_event_id TEXT PRIMARY KEY,
  constitution_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT,
  related_entity_id TEXT,
  summary TEXT NOT NULL,
  evidence_refs TEXT NOT NULL,             -- JSON array
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (constitution_id) REFERENCES live_governance_constitutions(constitution_id)
);

CREATE INDEX IF NOT EXISTS idx_constitutional_audit_events_constitution_time
ON constitutional_audit_events (constitution_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_constitutional_audit_events_type
ON constitutional_audit_events (event_type, timestamp DESC);

-- ============================================================================
-- Oversight Layer
-- ============================================================================

CREATE TABLE IF NOT EXISTS evolution_portfolio_oversight (
  oversight_id TEXT PRIMARY KEY,
  constitution_id TEXT NOT NULL,
  active_adaptation_loop_ids TEXT NOT NULL,  -- JSON array
  active_amendment_candidate_ids TEXT NOT NULL, -- JSON array
  active_doctrine_retirement_ids TEXT NOT NULL, -- JSON array
  portfolio_risk_score INTEGER NOT NULL,     -- 0..100
  portfolio_state TEXT NOT NULL,             -- stable|active|pressured|overloaded
  recommended_action TEXT NOT NULL,          -- continue|slow_down|prioritize|freeze_noncritical
  evaluated_at INTEGER NOT NULL,
  FOREIGN KEY (constitution_id) REFERENCES live_governance_constitutions(constitution_id)
);

CREATE TABLE IF NOT EXISTS constitutional_precedence_registry (
  precedence_id TEXT PRIMARY KEY,
  constitution_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,               -- doctrine|override_rule|operator_authority_rule|judgment_rule|amendment_rule
  entity_id TEXT NOT NULL,
  precedence_rank INTEGER NOT NULL,         -- lower = stronger
  precedence_reason TEXT NOT NULL,
  supersedes_entity_ids TEXT NOT NULL,      -- JSON array
  registered_at INTEGER NOT NULL,
  FOREIGN KEY (constitution_id) REFERENCES live_governance_constitutions(constitution_id)
);

CREATE TABLE IF NOT EXISTS governance_arbitration_cases (
  case_id TEXT PRIMARY KEY,
  constitution_id TEXT NOT NULL,
  case_type TEXT NOT NULL,
  involved_entity_ids TEXT NOT NULL,        -- JSON array
  summary TEXT NOT NULL,
  case_state TEXT NOT NULL,                -- opened|under_review|resolved|escalated
  opened_at INTEGER NOT NULL,
  resolved_at INTEGER,
  FOREIGN KEY (constitution_id) REFERENCES live_governance_constitutions(constitution_id)
);

CREATE TABLE IF NOT EXISTS meta_governance_reviews (
  review_id TEXT PRIMARY KEY,
  constitution_id TEXT NOT NULL,
  focus TEXT NOT NULL,
  reviewed_entity_ids TEXT NOT NULL,        -- JSON array
  findings TEXT NOT NULL,                   -- JSON array
  review_outcome TEXT NOT NULL,            -- healthy|improvement_required|risk_detected|critical_defect
  recommended_next_action TEXT NOT NULL,
  reviewed_at INTEGER NOT NULL,
  FOREIGN KEY (constitution_id) REFERENCES live_governance_constitutions(constitution_id)
);

-- ============================================================================
-- Sovereignty & Federation Layer
-- ============================================================================

CREATE TABLE IF NOT EXISTS sovereign_readiness_states (
  closure_id TEXT PRIMARY KEY,
  constitution_id TEXT NOT NULL,
  boundary_state TEXT NOT NULL,
  external_interface_state TEXT NOT NULL,
  federation_readiness_state TEXT NOT NULL,
  stress_readiness_state TEXT NOT NULL,
  closure_decision TEXT NOT NULL,
  rationale TEXT NOT NULL,
  decided_at INTEGER NOT NULL,
  FOREIGN KEY (constitution_id) REFERENCES live_governance_constitutions(constitution_id)
);

CREATE TABLE IF NOT EXISTS federated_constitutional_orchestrations (
  orchestration_id TEXT PRIMARY KEY,
  primary_constitution_id TEXT NOT NULL,
  federated_constitution_ids TEXT NOT NULL,  -- JSON array
  shared_coordination_modes TEXT NOT NULL,   -- JSON array
  orchestration_state TEXT NOT NULL,         -- forming|active|restricted|fragmented
  coordination_risk_score INTEGER NOT NULL,  -- 0..100
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cross_sovereign_legitimacy_synthesis (
  synthesis_id TEXT PRIMARY KEY,
  constitution_ids TEXT NOT NULL,            -- JSON array
  aggregate_legitimacy_score INTEGER NOT NULL,
  mutual_trust_aggregate_score INTEGER NOT NULL,
  compatibility_score INTEGER NOT NULL,
  synthesis_state TEXT NOT NULL,             -- nonviable|fragile|viable|strong
  evaluated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS civilization_scale_disputes (
  dispute_id TEXT PRIMARY KEY,
  orchestration_id TEXT NOT NULL,
  involved_constitution_ids TEXT NOT NULL,   -- JSON array
  dispute_type TEXT NOT NULL,
  severity TEXT NOT NULL,                    -- medium|high|critical|systemic
  summary TEXT NOT NULL,
  state TEXT NOT NULL,                       -- opened|harmonizing|resolved|fragmented
  opened_at INTEGER NOT NULL,
  resolved_at INTEGER
);

CREATE TABLE IF NOT EXISTS multi_domain_constitutional_intelligence (
  intelligence_id TEXT PRIMARY KEY,
  orchestration_id TEXT NOT NULL,
  observed_constitution_ids TEXT NOT NULL,   -- JSON array
  federation_health_score INTEGER NOT NULL,
  legitimacy_alignment_score INTEGER NOT NULL,
  dispute_pressure_score INTEGER NOT NULL,
  boundary_integrity_score INTEGER NOT NULL,
  orchestration_stability_score INTEGER NOT NULL,
  intelligence_state TEXT NOT NULL,          -- clear|watch|strained|fracturing
  recommended_priority TEXT NOT NULL,
  evaluated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS governance_synthesis_states (
  closure_id TEXT PRIMARY KEY,
  orchestration_id TEXT NOT NULL,
  orchestration_state TEXT NOT NULL,
  legitimacy_synthesis_state TEXT NOT NULL,
  dispute_harmonization_state TEXT NOT NULL,
  constitutional_intelligence_state TEXT NOT NULL,
  closure_decision TEXT NOT NULL,
  rationale TEXT NOT NULL,
  decided_at INTEGER NOT NULL
);

-- ============================================================================
-- Continuity Layer
-- ============================================================================

CREATE TABLE IF NOT EXISTS long_horizon_constitutional_memory (
  memory_id TEXT PRIMARY KEY,
  constitution_id TEXT NOT NULL,
  epoch TEXT NOT NULL,
  key_decisions TEXT NOT NULL,               -- JSON array
  key_doctrines TEXT NOT NULL,               -- JSON array
  critical_incidents TEXT NOT NULL,          -- JSON array
  evolution_summary TEXT NOT NULL,
  retained_importance_score INTEGER NOT NULL, -- 0..100
  created_at INTEGER NOT NULL,
  FOREIGN KEY (constitution_id) REFERENCES live_governance_constitutions(constitution_id)
);

CREATE TABLE IF NOT EXISTS civilizational_drift_signals (
  drift_id TEXT PRIMARY KEY,
  constitution_id TEXT NOT NULL,
  drift_vectors TEXT NOT NULL,               -- JSON array
  drift_score INTEGER NOT NULL,              -- 0..100
  drift_state TEXT NOT NULL,                 -- stable|emerging|significant|critical
  detected_at INTEGER NOT NULL,
  FOREIGN KEY (constitution_id) REFERENCES live_governance_constitutions(constitution_id)
);

CREATE TABLE IF NOT EXISTS intergenerational_amendment_checks (
  check_id TEXT PRIMARY KEY,
  constitution_id TEXT NOT NULL,
  amendment_id TEXT NOT NULL,
  forward_compatibility_score INTEGER NOT NULL,
  backward_compatibility_score INTEGER NOT NULL,
  evolution_stability_score INTEGER NOT NULL,
  generational_impact TEXT NOT NULL,         -- safe|risky|destabilizing
  checked_at INTEGER NOT NULL,
  FOREIGN KEY (constitution_id) REFERENCES live_governance_constitutions(constitution_id)
);

CREATE TABLE IF NOT EXISTS long_cycle_governance_adaptations (
  cycle_id TEXT PRIMARY KEY,
  constitution_id TEXT NOT NULL,
  cycle_phase TEXT NOT NULL,                 -- stabilization|pressure_accumulation|adaptation|re_stabilization
  epoch_reference TEXT NOT NULL,
  stability_score INTEGER NOT NULL,
  next_recommended_phase TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (constitution_id) REFERENCES live_governance_constitutions(constitution_id)
);

CREATE TABLE IF NOT EXISTS civilizational_continuity_states (
  closure_id TEXT PRIMARY KEY,
  constitution_id TEXT NOT NULL,
  memory_integrity_state TEXT NOT NULL,      -- strong|partial|weak
  drift_state TEXT NOT NULL,                 -- stable|emerging|critical
  generational_stability_state TEXT NOT NULL, -- safe|risky|unstable
  long_cycle_state TEXT NOT NULL,            -- stable|adapting|unstable
  closure_decision TEXT NOT NULL,            -- civilization_stable|stable_with_risks|unstable
  rationale TEXT NOT NULL,
  decided_at INTEGER NOT NULL,
  FOREIGN KEY (constitution_id) REFERENCES live_governance_constitutions(constitution_id)
);

-- ============================================================================
-- Default constitution seed (if not exists)
-- ============================================================================

INSERT OR IGNORE INTO live_governance_constitutions (
  constitution_id,
  active_doctrine_ids,
  active_conflict_ids,
  active_judgment_ids,
  active_override_ids,
  active_operator_authority_ids,
  constitutional_state,
  legitimacy_score,
  governance_coherence_score,
  last_ratified_at
) VALUES (
  'live_governance_constitution_main',
  '[]',
  '[]',
  '[]',
  '[]',
  '[]',
  'stable',
  85,
  82,
  strftime('%s', 'now') * 1000
);
