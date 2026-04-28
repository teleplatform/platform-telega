// ─────────────────────────────────────────────────────────────
// ALICE LIVE OPERATIONS / POST-LAUNCH CONTROL PACK v1.0 — Core Types
//
// Status: IMPLEMENTATION_SPEC
// Depends on: Alice External Launch / Go-Live v1.0 + all prior Alice layers
//
// CORE DECISION: Live traffic ≠ healthy operations.
// This layer controls post-launch operational truth, not business analytics.
// ─────────────────────────────────────────────────────────────

// -- Live operational state --
export type AliceLiveOperationalState = {
  state: "live" | "degraded" | "held" | "disabled" | "unknown";
  source: "operator" | "health" | "launch" | "fallback";
  updatedAt: string;
  notes?: string[];
};

// -- Live health snapshot --
export type AliceLiveHealthSnapshot = {
  health: "healthy" | "degraded" | "unknown";

  checks: {
    ingressAlive: boolean;
    protocolAlive: boolean;
    bridgeAlive: boolean;
    safeFallbackAvailable: boolean;
  };

  warnings?: string[];
  notes?: string[];
};

// -- Anomaly signal --
export type AliceAnomalySignal = {
  signalId: string;
  severity: "low" | "medium" | "high";

  type:
    | "ingress_unreachable"
    | "protocol_failure"
    | "bridge_failure"
    | "unsafe_response_path"
    | "repeated_fallback"
    | "unknown";

  observedAt: string;
  notes?: string[];
};

// -- Operator control decision --
export type AliceOperatorControlDecision = {
  action: "none" | "hold" | "degrade" | "disable" | "resume";
  accepted: boolean;

  resultingState:
    | "live"
    | "degraded"
    | "held"
    | "disabled"
    | "unknown";

  reason?: string;
  notes?: string[];
};

// -- Live ops adapter descriptor --
export type AliceLiveOpsAdapter = {
  adapterId: "alice_live_operations_v1";
  version: string;

  supportsOperationalState: boolean;
  supportsLiveHealthSnapshot: boolean;
  supportsOperatorControls: boolean;
  supportsDegradeMode: boolean;
  supportsDisableMode: boolean;
  supportsAnomalySignals: boolean;
};

// -- ValidationError --
export type AliceOpsValidationError = {
  path: string;
  message: string;
};

// -- Live ops policy --
export type AliceLiveOpsPolicy = {
  allowHold: boolean;
  allowDegrade: boolean;
  allowDisable: boolean;
  allowResume: boolean;
  anomalyThresholds: {
    highSeverityTriggersDegrade: boolean;
    mediumSeverityTriggersWarning: boolean;
    repeatedLowSeverityCount: number;
  };
};
