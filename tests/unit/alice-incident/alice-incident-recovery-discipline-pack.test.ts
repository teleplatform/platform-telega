// Alice Incident / Recovery Discipline Pack v1.0 — Unit Tests
// Run with: npx tsx tests/unit/alice-incident/alice-incident-recovery-discipline-pack.test.ts

import assert from "node:assert/strict";
import { aliceIncidentRecoveryAdapter } from "../../../src/alice-incident/builtin.js";
import { validateAliceIncidentRecoveryAdapter } from "../../../src/alice-incident/validators.js";
import {
  getAliceIncidentRecoveryAdapter,
  supportsIncidentState,
  supportsSeverityResolution,
  supportsRecoveryPlaybooks,
  supportsRecoveryDecisions,
  supportsRecoveryOutcome,
  supportsSafeRestoration,
  getAdapterVersion,
  getAdapterId,
} from "../../../src/alice-incident/selectors.js";
import {
  buildAliceIncidentRecord,
  transitionIncidentStatus,
} from "../../../src/alice-incident/incident.js";
import {
  resolveAliceIncidentSeverity,
  getSeverityDescription,
} from "../../../src/alice-incident/severity.js";
import {
  buildAliceIncidentState,
  getDefaultIncidentState,
  transitionIncidentState,
} from "../../../src/alice-incident/states.js";
import {
  resolveIncidentFromLiveSignals,
} from "../../../src/alice-incident/signals.js";
import {
  selectAliceRecoveryPlaybook,
  getAllPlaybooks,
  getPlaybookDescription,
} from "../../../src/alice-incident/playbooks.js";
import {
  buildAliceRecoveryDecision,
  executeAliceRecoveryDecision,
} from "../../../src/alice-incident/recovery.js";
import {
  buildAliceRecoveryOutcome,
  canRestoreAliceLive,
} from "../../../src/alice-incident/restoration.js";
import {
  applyIncidentControlImpact,
} from "../../../src/alice-incident/controls.js";
import {
  prepareAliceIncidentRecoveryState,
} from "../../../src/alice-incident/adapter.js";
import type {
  AliceAnomalySignal,
  AliceLiveHealthSnapshot,
  AliceLiveOperationalState,
} from "../../../src/alice-ops/types.js";

// Auto-registered via builtin import
const ADAPTER = aliceIncidentRecoveryAdapter;

// Helper to create test anomaly signals
function createAnomalySignal(type: AliceAnomalySignal["type"], severity: "low" | "medium" | "high"): AliceAnomalySignal {
  return {
    signalId: "test-signal",
    severity,
    type,
    observedAt: new Date().toISOString(),
  };
}

// Helper to create test health
function createTestHealth(overrides?: Partial<AliceLiveHealthSnapshot["checks"]>): AliceLiveHealthSnapshot {
  return {
    health: "healthy",
    checks: {
      ingressAlive: true,
      protocolAlive: true,
      bridgeAlive: true,
      safeFallbackAvailable: true,
      ...overrides,
    },
  };
}

// Helper to create test live state
function createTestLiveState(state: AliceLiveOperationalState["state"] = "live"): AliceLiveOperationalState {
  return {
    state,
    source: "health",
    updatedAt: new Date().toISOString(),
  };
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
  }
}

// ── Builtin Loading ──
console.log("\nBuiltin loading:");

test("builtin incident recovery adapter loads", () => {
  assert.ok(ADAPTER);
  assert.equal(ADAPTER.adapterId, "alice_incident_recovery_v1");
  assert.equal(ADAPTER.version, "1.0.0");
});

test("builtin has all feature flags", () => {
  assert.equal(ADAPTER.supportsIncidentState, true);
  assert.equal(ADAPTER.supportsSeverityResolution, true);
  assert.equal(ADAPTER.supportsRecoveryPlaybooks, true);
  assert.equal(ADAPTER.supportsRecoveryDecisions, true);
  assert.equal(ADAPTER.supportsRecoveryOutcome, true);
  assert.equal(ADAPTER.supportsSafeRestoration, true);
});

// ── Validation ──
console.log("\nValidation:");

test("builtin adapter validates with no errors", () => {
  const errors = validateAliceIncidentRecoveryAdapter(ADAPTER);
  assert.equal(errors.length, 0, `Validation errors: ${JSON.stringify(errors)}`);
});

// ── Incident Record ──
console.log("\nIncident record:");

test("buildAliceIncidentRecord builds valid incident", () => {
  const record = buildAliceIncidentRecord({
    severity: "high",
    trigger: "ingress_failure",
  });
  assert.ok(record.incidentId);
  assert.ok(record.createdAt);
  assert.equal(record.status, "suspected");
  assert.equal(record.severity, "high");
  assert.equal(record.trigger, "ingress_failure");
});

test("transitionIncidentStatus transitions status correctly", () => {
  const record = buildAliceIncidentRecord({ severity: "medium", trigger: "protocol_failure" });
  const transitioned = transitionIncidentStatus(record, "confirmed");
  assert.equal(transitioned.status, "confirmed");
});

// ── Severity Resolution ──
console.log("\nSeverity resolution:");

test("resolveAliceIncidentSeverity returns critical for high anomaly", () => {
  const signals = [createAnomalySignal("ingress_unreachable", "high")];
  const severity = resolveAliceIncidentSeverity({ anomalySignals: signals });
  assert.equal(severity.severity, "critical");
});

test("resolveAliceIncidentSeverity returns high for unknown health", () => {
  const severity = resolveAliceIncidentSeverity({ healthImpact: "unknown" });
  assert.equal(severity.severity, "high");
});

test("resolveAliceIncidentSeverity returns medium for medium anomaly", () => {
  const signals = [createAnomalySignal("unsafe_response_path", "medium")];
  const severity = resolveAliceIncidentSeverity({ anomalySignals: signals, healthImpact: "healthy" });
  assert.equal(severity.severity, "medium");
});

test("resolveAliceIncidentSeverity returns low for no anomalies", () => {
  const severity = resolveAliceIncidentSeverity({ anomalySignals: [], healthImpact: "healthy" });
  assert.equal(severity.severity, "low");
});

test("resolveAliceIncidentSeverity returns high for manual escalation", () => {
  const severity = resolveAliceIncidentSeverity({ isManualEscalation: true });
  assert.equal(severity.severity, "high");
});

test("getSeverityDescription returns description for each severity", () => {
  assert.ok(getSeverityDescription("low").length > 0);
  assert.ok(getSeverityDescription("medium").length > 0);
  assert.ok(getSeverityDescription("high").length > 0);
  assert.ok(getSeverityDescription("critical").length > 0);
});

// ── Incident State ──
console.log("\nIncident state:");

test("buildAliceIncidentState builds valid state", () => {
  const state = buildAliceIncidentState({
    state: "active",
    source: "signals",
  });
  assert.equal(state.state, "active");
  assert.equal(state.source, "signals");
  assert.ok(state.updatedAt);
});

test("getDefaultIncidentState returns none state", () => {
  const state = getDefaultIncidentState();
  assert.equal(state.state, "none");
  assert.equal(state.source, "health");
});

test("transitionIncidentState transitions correctly", () => {
  const current = buildAliceIncidentState({ state: "suspected", source: "signals" });
  const next = transitionIncidentState(current, "active", "operator");
  assert.equal(next.state, "active");
  assert.equal(next.source, "operator");
});

// ── Signal Classification ──
console.log("\nSignal classification:");

test("resolveIncidentFromLiveSignals returns no incident for healthy system", () => {
  const result = resolveIncidentFromLiveSignals({
    anomalySignals: [],
    health: createTestHealth(),
    liveState: createTestLiveState("live"),
  });
  assert.equal(result.isIncident, false);
});

test("resolveIncidentFromLiveSignals classifies ingress failure as incident", () => {
  const signals = [createAnomalySignal("ingress_unreachable", "high")];
  const result = resolveIncidentFromLiveSignals({
    anomalySignals: signals,
    health: createTestHealth({ ingressAlive: false }),
    liveState: createTestLiveState("degraded"),
  });
  assert.equal(result.isIncident, true);
  assert.equal(result.trigger, "ingress_failure");
});

test("resolveIncidentFromLiveSignals classifies protocol failure as incident", () => {
  const signals = [createAnomalySignal("protocol_failure", "high")];
  const result = resolveIncidentFromLiveSignals({
    anomalySignals: signals,
    health: createTestHealth({ protocolAlive: false }),
    liveState: createTestLiveState("degraded"),
  });
  assert.equal(result.isIncident, true);
  assert.equal(result.trigger, "protocol_failure");
});

test("resolveIncidentFromLiveSignals classifies bridge failure as incident", () => {
  const signals = [createAnomalySignal("bridge_failure", "high")];
  const result = resolveIncidentFromLiveSignals({
    anomalySignals: signals,
    health: createTestHealth({ bridgeAlive: false }),
    liveState: createTestLiveState("disabled"),
  });
  assert.equal(result.isIncident, true);
  assert.equal(result.trigger, "bridge_failure");
});

test("resolveIncidentFromLiveSignals classifies repeated fallback as incident", () => {
  const signals = [createAnomalySignal("repeated_fallback", "medium")];
  const result = resolveIncidentFromLiveSignals({
    anomalySignals: signals,
    health: createTestHealth(),
    liveState: createTestLiveState("disabled"), // Disabled state triggers incident
  });
  assert.equal(result.isIncident, true);
  assert.equal(result.trigger, "repeated_fallback");
});

// ── Playbook Selection ──
console.log("\nPlaybook selection:");

test("selectAliceRecoveryPlaybook returns matching playbooks for ingress_failure", () => {
  const playbooks = selectAliceRecoveryPlaybook("ingress_failure");
  assert.ok(playbooks.length > 0);
  assert.ok(playbooks.some((p) => p.playbookId === "recheck_ingress"));
});

test("selectAliceRecoveryPlaybook returns matching playbooks for protocol_failure", () => {
  const playbooks = selectAliceRecoveryPlaybook("protocol_failure");
  assert.ok(playbooks.some((p) => p.playbookId === "recheck_protocol"));
});

test("selectAliceRecoveryPlaybook returns safe_hold for unknown trigger", () => {
  const playbooks = selectAliceRecoveryPlaybook("unknown");
  assert.ok(playbooks.some((p) => p.playbookId === "safe_hold"));
});

test("getAllPlaybooks returns all 7 playbooks", () => {
  const playbooks = getAllPlaybooks();
  assert.equal(playbooks.length, 7);
});

test("getPlaybookDescription returns description", () => {
  assert.ok(getPlaybookDescription("recheck_ingress").length > 0);
  assert.ok(getPlaybookDescription("controlled_restore").length > 0);
});

// ── Recovery Decision ──
console.log("\nRecovery decision:");

test("buildAliceRecoveryDecision accepts attempt_recovery for non-active incident", () => {
  const decision = buildAliceRecoveryDecision({
    action: "attempt_recovery",
    incidentState: "suspected",
  });
  assert.equal(decision.accepted, true);
});

test("buildAliceRecoveryDecision rejects attempt_recovery if previously attempted", () => {
  const decision = buildAliceRecoveryDecision({
    action: "attempt_recovery",
    incidentState: "suspected",
    recoveryPreviouslyAttempted: true,
  });
  assert.equal(decision.accepted, false);
});

test("buildAliceRecoveryDecision rejects restore_live for active incident", () => {
  const decision = buildAliceRecoveryDecision({
    action: "restore_live",
    incidentState: "active",
  });
  assert.equal(decision.accepted, false);
});

test("buildAliceRecoveryDecision rejects restore_live for failed_recovery", () => {
  const decision = buildAliceRecoveryDecision({
    action: "restore_live",
    incidentState: "failed_recovery",
  });
  assert.equal(decision.accepted, false);
});

test("executeAliceRecoveryDecision executes attempt_recovery correctly", () => {
  const decision = buildAliceRecoveryDecision({
    action: "attempt_recovery",
    incidentState: "suspected",
  });
  const result = executeAliceRecoveryDecision(decision, { state: "suspected", source: "signals", updatedAt: "" });
  assert.equal(result.newState, "recovering");
  assert.equal(result.outcome, "partially_recovered");
});

test("executeAliceRecoveryDecision returns not_attempted for rejected decision", () => {
  const decision = buildAliceRecoveryDecision({
    action: "restore_live",
    incidentState: "active",
  });
  const result = executeAliceRecoveryDecision(decision, { state: "active", source: "signals", updatedAt: "" });
  assert.equal(result.outcome, "not_attempted");
});

// ── Recovery Outcome ──
console.log("\nRecovery outcome:");

test("buildAliceRecoveryOutcome returns recovered for full success", () => {
  const outcome = buildAliceRecoveryOutcome({
    recoveryAttempted: true,
    recoverySucceeded: true,
    partialRecovery: false,
    targetState: "live",
  });
  assert.equal(outcome.outcome, "recovered");
  assert.equal(outcome.restoredState, "live");
});

test("buildAliceRecoveryOutcome returns partially_recovered for partial success", () => {
  const outcome = buildAliceRecoveryOutcome({
    recoveryAttempted: true,
    recoverySucceeded: true,
    partialRecovery: true,
    targetState: "degraded",
  });
  assert.equal(outcome.outcome, "partially_recovered");
  assert.equal(outcome.restoredState, "degraded");
});

test("buildAliceRecoveryOutcome returns failed for failed recovery", () => {
  const outcome = buildAliceRecoveryOutcome({
    recoveryAttempted: true,
    recoverySucceeded: false,
    partialRecovery: false,
    targetState: "disabled",
  });
  assert.equal(outcome.outcome, "failed");
});

test("buildAliceRecoveryOutcome returns not_attempted if not attempted", () => {
  const outcome = buildAliceRecoveryOutcome({
    recoveryAttempted: false,
    recoverySucceeded: false,
    partialRecovery: false,
    targetState: "unknown",
  });
  assert.equal(outcome.outcome, "not_attempted");
});

// ── Restoration Gate ──
console.log("\nRestoration gate:");

test("canRestoreAliceLive returns true when all conditions met", () => {
  const result = canRestoreAliceLive({
    incidentState: "restored",
    recoveryOutcome: "recovered",
    healthChecksPassed: true,
    operatorApproved: true,
  });
  assert.equal(result.canRestore, true);
});

test("canRestoreAliceLive returns false if incident still active", () => {
  const result = canRestoreAliceLive({
    incidentState: "active",
    recoveryOutcome: "recovered",
    healthChecksPassed: true,
    operatorApproved: true,
  });
  assert.equal(result.canRestore, false);
  assert.ok(result.reason?.includes("active"));
});

test("canRestoreAliceLive returns false if recovery failed", () => {
  const result = canRestoreAliceLive({
    incidentState: "restored",
    recoveryOutcome: "failed",
    healthChecksPassed: true,
    operatorApproved: true,
  });
  assert.equal(result.canRestore, false);
  assert.ok(result.reason?.includes("failed"));
});

test("canRestoreAliceLive returns false if health checks not passed", () => {
  const result = canRestoreAliceLive({
    incidentState: "restored",
    recoveryOutcome: "recovered",
    healthChecksPassed: false,
    operatorApproved: true,
  });
  assert.equal(result.canRestore, false);
});

test("canRestoreAliceLive returns false without operator approval", () => {
  const result = canRestoreAliceLive({
    incidentState: "restored",
    recoveryOutcome: "recovered",
    healthChecksPassed: true,
    operatorApproved: false,
  });
  assert.equal(result.canRestore, false);
});

// ── Control Impact ──
console.log("\nControl impact:");

test("applyIncidentControlImpact returns disabled for critical severity active incident", () => {
  const state = applyIncidentControlImpact({
    currentLiveState: "live",
    incidentState: "active",
    severity: "critical",
  });
  assert.equal(state, "disabled");
});

test("applyIncidentControlImpact returns degraded for high severity active incident", () => {
  const state = applyIncidentControlImpact({
    currentLiveState: "live",
    incidentState: "active",
    severity: "high",
  });
  assert.equal(state, "degraded");
});

test("applyIncidentControlImpact returns current state for recovering", () => {
  const state = applyIncidentControlImpact({
    currentLiveState: "degraded",
    incidentState: "recovering",
    severity: "high",
  });
  assert.equal(state, "degraded");
});

test("applyIncidentControlImpact returns live for restored incident", () => {
  const state = applyIncidentControlImpact({
    currentLiveState: "degraded",
    incidentState: "restored",
    severity: "low",
  });
  assert.equal(state, "live");
});

// ── Main Handler ──
console.log("\nMain handler:");

test("prepareAliceIncidentRecoveryState returns no incident for healthy system", () => {
  const result = prepareAliceIncidentRecoveryState({
    currentLiveState: "live",
    health: createTestHealth(),
    anomalySignals: [],
  });
  assert.equal(result.incidentState.state, "none");
  assert.equal(result.incidentRecord, undefined);
});

test("prepareAliceIncidentRecoveryState detects incident for critical anomaly", () => {
  const signals = [createAnomalySignal("ingress_unreachable", "high")];
  const result = prepareAliceIncidentRecoveryState({
    currentLiveState: "live",
    health: createTestHealth({ ingressAlive: false }),
    anomalySignals: signals,
  });
  assert.equal(result.incidentState.state, "active");
  assert.ok(result.incidentRecord);
  assert.equal(result.incidentRecord!.severity, "critical");
});

test("prepareAliceIncidentRecoveryState selects recovery playbook for incident", () => {
  const signals = [createAnomalySignal("ingress_unreachable", "high")];
  const result = prepareAliceIncidentRecoveryState({
    currentLiveState: "live",
    health: createTestHealth({ ingressAlive: false }),
    anomalySignals: signals,
  });
  assert.ok(result.recoveryPlaybooks.length > 0);
  assert.ok(result.recoveryPlaybooks.some((p) => p.playbookId === "recheck_ingress"));
});

test("prepareAliceIncidentRecoveryState does not allow restore_live without restoration gate", () => {
  const result = prepareAliceIncidentRecoveryState({
    currentLiveState: "live",
    health: createTestHealth({ ingressAlive: false }),
    anomalySignals: [createAnomalySignal("ingress_unreachable", "high")],
    recoveryAction: "restore_live",
  });
  assert.equal(result.recoveryDecision.accepted, false);
  assert.equal(result.restorationEligible.canRestore, false);
});

// ── Selectors ──
console.log("\nSelectors:");

test("getAliceIncidentRecoveryAdapter returns adapter", () => {
  const adapter = getAliceIncidentRecoveryAdapter();
  assert.ok(adapter);
  assert.equal(adapter!.adapterId, "alice_incident_recovery_v1");
});

test("supportsIncidentState returns true", () => {
  assert.equal(supportsIncidentState(), true);
});

test("supportsSeverityResolution returns true", () => {
  assert.equal(supportsSeverityResolution(), true);
});

test("supportsRecoveryPlaybooks returns true", () => {
  assert.equal(supportsRecoveryPlaybooks(), true);
});

test("supportsRecoveryDecisions returns true", () => {
  assert.equal(supportsRecoveryDecisions(), true);
});

test("supportsRecoveryOutcome returns true", () => {
  assert.equal(supportsRecoveryOutcome(), true);
});

test("supportsSafeRestoration returns true", () => {
  assert.equal(supportsSafeRestoration(), true);
});

test("getAdapterVersion returns 1.0.0", () => {
  assert.equal(getAdapterVersion(), "1.0.0");
});

test("getAdapterId returns alice_incident_recovery_v1", () => {
  assert.equal(getAdapterId(), "alice_incident_recovery_v1");
});

// ── Sanity Checks ──
console.log("\nSanity checks:");

test("no restore if incident active", () => {
  const result = canRestoreAliceLive({
    incidentState: "active",
    recoveryOutcome: "recovered",
    healthChecksPassed: true,
    operatorApproved: true,
  });
  assert.equal(result.canRestore, false);
});

test("no restore if recovery failed", () => {
  const result = canRestoreAliceLive({
    incidentState: "restored",
    recoveryOutcome: "failed",
    healthChecksPassed: true,
    operatorApproved: true,
  });
  assert.equal(result.canRestore, false);
});

test("no fake recovery from one success", () => {
  // Partial recovery ≠ recovered
  const outcome = buildAliceRecoveryOutcome({
    recoveryAttempted: true,
    recoverySucceeded: true,
    partialRecovery: true,
    targetState: "degraded",
  });
  assert.equal(outcome.outcome, "partially_recovered");
  assert.notEqual(outcome.outcome, "recovered");
});

test("partial recovery ≠ restored live", () => {
  const outcome = buildAliceRecoveryOutcome({
    recoveryAttempted: true,
    recoverySucceeded: true,
    partialRecovery: true,
    targetState: "degraded",
  });
  assert.equal(outcome.restoredState, "degraded");
  assert.notEqual(outcome.restoredState, "live");
});

// ── Results ──
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
