// ─────────────────────────────────────────────────────────────
// ALICE EXTERNAL LAUNCH / GO-LIVE PACK v1.0 — Core Types
//
// Status: IMPLEMENTATION_SPEC
// Depends on: Alice Publish / Skill Registration v1.0 + all prior Alice layers
//
// CORE DECISION: Go-live success ≠ user success.
// This layer controls the launch decision, not product adoption truth.
// ─────────────────────────────────────────────────────────────

// -- Launch plan (formal launch contract) --
export type AliceLaunchPlan = {
  launchId: string;
  skillId: "arisha_alice_skill_v1";

  mode: "dry_run" | "internal_only" | "controlled_live";
  targetSurface: "alice";

  requiresReadinessPass: boolean;
  requiresSmokePass: boolean;
  allowsRollback: boolean;

  createdAt: string;
  notes?: string[];
};

// -- Gate check result --
export type AliceGoLiveGateResult = {
  gatesPassed: boolean;

  checks: {
    publishReadinessPassed: boolean;
    endpointDeclared: boolean;
    ingressHardeningEnabled: boolean;
    protocolAdapterReady: boolean;
    webhookRouteReady: boolean;
  };

  blockers?: string[];
  warnings?: string[];
};

// -- Smoke check result --
export type AliceLaunchSmokeResult = {
  smokePassed: boolean;

  checks: {
    ingressReachable: boolean;
    protocolMappingWorks: boolean;
    bridgeAdapterWorks: boolean;
    safeErrorPathWorks: boolean;
  };

  blockers?: string[];
  warnings?: string[];
};

// -- Launch outcome --
export type AliceLaunchOutcome = {
  launchAccepted: boolean;
  launchState:
    | "not_started"
    | "gated"
    | "smoke_failed"
    | "live"
    | "held"
    | "rolled_back"
    | "failed";

  reason?: string;
  notes?: string[];
};

// -- Go-live adapter descriptor --
export type AliceGoLiveAdapter = {
  adapterId: "alice_external_launch_v1";
  version: string;

  supportsLaunchPlan: boolean;
  supportsGateValidation: boolean;
  supportsSmokeChecks: boolean;
  supportsControlledModes: boolean;
  supportsRollbackDiscipline: boolean;
  supportsLaunchOutcomeTracking: boolean;
};

// -- Launch health snapshot --
export type AliceLaunchHealthSnapshot = {
  state: "healthy" | "degraded" | "unknown";
  launchState: AliceLaunchOutcome["launchState"];
  checksPassed: number;
  checksFailed: number;
  timestamp: string;
};

// -- Rollback decision --
export type AliceRollbackDecision = {
  shouldRollback: boolean;
  reason?: string;
  targetState: "held" | "rolled_back" | "failed";
  notes?: string[];
};

// -- ValidationError --
export type AliceLaunchValidationError = {
  path: string;
  message: string;
};
