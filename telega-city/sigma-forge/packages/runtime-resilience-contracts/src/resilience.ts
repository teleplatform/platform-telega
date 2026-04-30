export type CrisisType =
  | "transport_outage"
  | "federation_disconnect"
  | "external_contract_revocation"
  | "budget_collapse"
  | "region_restriction_event"
  | "operator_ban"
  | "dependency_loss"
  | "audit_pipeline_failure"
  | "strategy_instability_event"
  | "cross_zone_partition"
  | "rollback_reserve_exhaustion"
  | "compliance_emergency";

export type CrisisSeverity = "low" | "medium" | "high" | "critical";
export type CrisisScope = "route" | "zone" | "portfolio" | "federation" | "external_contract" | "global";
export type CrisisStatus = "open" | "contained" | "mitigated" | "resolved";
export type ContinuityMode = "normal" | "degraded" | "isolated" | "local_only" | "sovereign_fallback" | "restricted_external" | "recovery_mode";
export type CrisisAction = "activate_degraded" | "isolate_zone" | "suspend_external" | "enter_sovereign_fallback" | "restrict_execution" | "re_enable_external" | "exit_crisis";
export type CrisisRole = "crisis_owner" | "federation_owner" | "safety_admin" | "budget_admin" | "recovery_admin" | "zone_owner" | "observer";

export interface CrisisEvent {
  crisis_id: string;
  crisis_type: CrisisType;
  severity: CrisisSeverity;
  affected_scope: CrisisScope;
  affected_ids: string[];
  detected_at: string;
  detected_by: string;
  status: CrisisStatus;
}

export interface ContinuityModeState {
  scope_type: CrisisScope;
  scope_id: string;
  current_mode: ContinuityMode;
  activated_at: string;
  activated_by: string;
  reason: string;
}

export interface SovereignFallbackProfile {
  profile_id: string;
  scope_id: string;
  surviving_capabilities: string[];
  excluded_dependencies: string[];
  local_policy_baseline: string;
  execution_classes_active: string[];
  execution_classes_frozen: string[];
  created_at: string;
}

export interface CrisisApprovalRule {
  rule_id: string;
  action_type: CrisisAction;
  required_roles: CrisisRole[];
  scope: CrisisScope;
  severity_threshold: CrisisSeverity;
}

export interface RecoveryAttemptRecord {
  recovery_id: string;
  crisis_id: string;
  scope_type: CrisisScope;
  scope_id: string;
  started_at: string;
  status: "running" | "completed" | "failed" | "rolled_back";
  rollback_reason?: string;
}

export interface ResilienceAuditEvent {
  event_type: string;
  actor: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface CrisisSimulationResult {
  simulation_id: string;
  scenario_type: CrisisType;
  scope_type: CrisisScope;
  scope_id: string;
  continuity_feasible: boolean;
  surviving_capabilities: string[];
  policy_breach_risks: string[];
  recovery_ready: boolean;
  audit_survivable: boolean;
  created_at: string;
}

export interface ExternalRecheckRecord {
  recheck_id: string;
  crisis_id: string;
  external_party_id: string;
  scope_reenabled: string;
  trust_reverified: boolean;
  compliance_reverified: boolean;
  rechecked_at: string;
  rechecked_by: string;
}
