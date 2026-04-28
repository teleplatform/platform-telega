// ─────────────────────────────────────────────────────────────
// ALICE INCIDENT / RECOVERY DISCIPLINE PACK v1.0 — Core Types
//
// Status: IMPLEMENTATION_SPEC
// Depends on: Alice Live Operations v1.0 + all prior Alice layers
//
// CORE DECISION: Incident truth ≠ live health truth ≠ launch truth.
// Recovered traffic must never masquerade as incident resolution.
// ─────────────────────────────────────────────────────────────

// -- Incident state --
export type AliceIncidentState = {
  state: "none" | "suspected" | "active" | "recovering" | "restored" | "failed_recovery";
  source: "operator" | "signals" | "health" | "fallback";
  updatedAt: string;
  notes?: string[];
};

// -- Incident severity --
export type AliceIncidentSeverity = {
  severity: "low" | "medium" | "high" | "critical";
  reason: string;
  notes?: string[];
};

// -- Incident record --
export type AliceIncidentRecord = {
  incidentId: string;
  createdAt: string;

  status: "suspected" | "confirmed" | "recovering" | "resolved" | "failed";

  severity: "low" | "medium" | "high" | "critical";

  trigger:
    | "ingress_failure"
    | "protocol_failure"
    | "bridge_failure"
    | "unsafe_response_path"
    | "repeated_fallback"
    | "manual_operator_action"
    | "unknown";

  notes?: string[];
};

// -- Recovery decision --
export type AliceRecoveryDecision = {
  action: "none" | "attempt_recovery" | "hold" | "degrade" | "disable" | "restore_live";
  accepted: boolean;
  reason?: string;
  notes?: string[];
};

// -- Recovery outcome --
export type AliceRecoveryOutcome = {
  outcome: "not_attempted" | "recovered" | "partially_recovered" | "failed";
  restoredState: "live" | "degraded" | "held" | "disabled" | "unknown";
  notes?: string[];
};

// -- Incident recovery adapter descriptor --
export type AliceIncidentRecoveryAdapter = {
  adapterId: "alice_incident_recovery_v1";
  version: string;

  supportsIncidentState: boolean;
  supportsSeverityResolution: boolean;
  supportsRecoveryPlaybooks: boolean;
  supportsRecoveryDecisions: boolean;
  supportsRecoveryOutcome: boolean;
  supportsSafeRestoration: boolean;
};

// -- Recovery playbook --
export type AliceRecoveryPlaybook = {
  playbookId:
    | "recheck_ingress"
    | "recheck_protocol"
    | "recheck_bridge"
    | "fallback_containment"
    | "safe_hold"
    | "manual_disable"
    | "controlled_restore";

  description: string;
  targetTrigger: AliceIncidentRecord["trigger"];
};

// -- ValidationError --
export type AliceIncidentValidationError = {
  path: string;
  message: string;
};

// -- Incident policy --
export type AliceIncidentRecoveryPolicy = {
  allowRecoveryAttempt: boolean;
  allowHold: boolean;
  allowDegrade: boolean;
  allowDisable: boolean;
  allowRestoreLive: boolean;
  severityThresholds: {
    highSeverityAutoDegrade: boolean;
    criticalSeverityAutoDisable: boolean;
  };
  restorationRequirements: {
    requiresCleanIncidentState: boolean;
    requiresSuccessfulRecovery: boolean;
    requiresOperatorApproval: boolean;
  };
};
