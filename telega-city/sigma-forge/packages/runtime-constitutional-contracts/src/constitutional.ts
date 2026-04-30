export type PrincipleCategory = 'safety' | 'governance' | 'trust' | 'continuity' | 'adaptation' | 'strategy';
export type PrincipleStatus = 'draft' | 'active' | 'superseded' | 'revoked';
export type DoctrineType = 'canon' | 'policy' | 'invariant' | 'architecture' | 'governance_rule';
export type DoctrineStatus = 'draft' | 'active' | 'superseded' | 'archived';
export type MemoryType = 'canonical_decision' | 'crisis_lesson' | 'governance_precedent' | 'rejected_dangerous_pattern' | 'migration_lesson' | 'compliance_lesson' | 'architecture_invariant' | 'failure_doctrine';
export type MemoryStatus = 'active' | 'deprecated' | 'superseded';
export type ChangeType = 'create' | 'amend' | 'supersede' | 'revoke';
export type ChangeStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'applied' | 'rolled_back';
export type ConflictResolution = 'higher_precedence_wins' | 'lower_rule_rejected' | 'both_superseded';

export interface ConstitutionalPrinciple {
  principle_id: string;
  title: string;
  description: string;
  category: PrincipleCategory;
  precedence_level: number;
  status: PrincipleStatus;
  created_at: string;
  created_by: string;
}

export interface DoctrineRecord {
  doctrine_id: string;
  title: string;
  doctrine_type: DoctrineType;
  linked_principle_ids: string[];
  linked_artifacts: string[];
  status: DoctrineStatus;
  created_at: string;
  created_by: string;
}

export interface InstitutionalMemoryRecord {
  memory_id: string;
  memory_type: MemoryType;
  title: string;
  summary: string;
  linked_principle_ids: string[];
  linked_doctrine_ids: string[];
  source_refs: string[];
  status: MemoryStatus;
  created_at: string;
  created_by: string;
}

export interface GovernancePrecedenceRule {
  rule_id: string;
  higher_type: string;
  lower_type: string;
  description: string;
  created_at: string;
}

export interface ConstitutionalChangeProposal {
  change_id: string;
  target_type: 'principle' | 'doctrine' | 'precedence_rule' | 'memory_record';
  target_id?: string;
  change_type: ChangeType;
  rationale: string;
  evidence_refs: string[];
  status: ChangeStatus;
  created_at: string;
  created_by: string;
}

export interface DoctrineConflictRecord {
  conflict_id: string;
  entity_a_type: string;
  entity_a_id: string;
  entity_b_type: string;
  entity_b_id: string;
  conflict_description: string;
  resolution: ConflictResolution;
  winner_id: string;
  resolved_at: string;
  resolved_by: string;
}

export interface ConstitutionalActivationRecord {
  activation_id: string;
  entity_type: string;
  entity_id: string;
  activated_at: string;
  activated_by: string;
  reason: string;
}

export interface ConstitutionalRollbackRecord {
  rollback_id: string;
  change_id: string;
  entity_type: string;
  entity_id: string;
  rolled_back_at: string;
  rolled_back_by: string;
  reason: string;
}

export interface ConstitutionalAuditEvent {
  event_type: string;
  actor: string;
  details: Record<string, unknown>;
  timestamp: string;
}
