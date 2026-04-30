export type ControlSurfaceType = 'runtime' | 'governance' | 'strategy' | 'portfolio' | 'federation' | 'crisis' | 'constitutional';
export type ControlSurfaceStatus = 'active' | 'restricted' | 'readonly';
export type GovernanceActionMode = 'read' | 'write';
export type RiskClass = 'low' | 'medium' | 'high' | 'critical';
export type ConfirmationMode = 'single' | 'elevated' | 'dual_control';
export type InterventionStatus = 'requested' | 'approved' | 'applied' | 'rejected' | 'rolled_back';

export interface ControlSurface {
  surface_id: string;
  surface_type: ControlSurfaceType;
  title: string;
  allowed_views: string[];
  allowed_actions: string[];
  required_role_map: Record<string, string[]>;
  status: ControlSurfaceStatus;
  created_at: string;
}

export interface HumanGovernanceAction {
  action_id: string;
  action_type: string;
  target_type: string;
  target_id: string;
  actor_id: string;
  actor_role: string;
  mode: GovernanceActionMode;
  risk_class: RiskClass;
  created_at: string;
}

export interface LegibilityDigest {
  digest_id: string;
  target_type: string;
  target_id: string;
  summary: string;
  evidence_refs: string[];
  active_constraints: string[];
  pending_actions: string[];
  risk_flags: string[];
  generated_at: string;
}

export interface TruthViewDescriptor {
  view_id: string;
  view_type: string;
  scope_type: string;
  scope_id: string;
  state_summary: string;
  provenance_refs: string[];
  active_constraints: string[];
  recent_decisions: string[];
  generated_at: string;
}

export interface GuardedWriteActionPolicy {
  policy_id: string;
  action_type: string;
  required_roles: string[];
  confirmation_mode: ConfirmationMode;
  blocked_if_constraints: string[];
}

export interface DecisionDigest {
  digest_id: string;
  digest_type: string;
  scope_type: string;
  scope_id: string;
  title: string;
  summary: string;
  what_changed: string[];
  what_blocked: string[];
  next_actions: string[];
  what_not_to_touch: string[];
  trace_refs: string[];
  generated_at: string;
}

export interface OperatorInterventionRequest {
  intervention_id: string;
  action_type: string;
  target_type: string;
  target_id: string;
  actor_id: string;
  reason: string;
  risk_class: RiskClass;
  status: InterventionStatus;
  created_at: string;
}

export interface ControlAuditEvent {
  event_type: string;
  actor_id: string;
  actor_role: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown>;
  timestamp: string;
}
