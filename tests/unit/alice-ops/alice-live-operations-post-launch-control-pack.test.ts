// Alice Live Operations / Post-Launch Control Pack v1.0 — Unit Tests
// Run with: npx tsx tests/unit/alice-ops/alice-live-operations-post-launch-control-pack.test.ts

import assert from "node:assert/strict";
import { aliceLiveOpsAdapter } from "../../../src/alice-ops/builtin.js";
import { validateAliceLiveOpsAdapter } from "../../../src/alice-ops/validators.js";
import {
  getAliceLiveOpsAdapter,
  supportsOperationalState,
  supportsLiveHealthSnapshot,
  supportsOperatorControls,
  supportsDegradeMode,
  supportsDisableMode,
  supportsAnomalySignals,
  getAdapterVersion,
  getAdapterId,
} from "../../../src/alice-ops/selectors.js";
import {
  buildAliceLiveOperationalState,
  getDefaultLiveState,
} from "../../../src/alice-ops/state.js";
import {
  buildAliceLiveHealthSnapshot,
  getHealthDescription,
} from "../../../src/alice-ops/health.js";
import {
  buildAliceAnomalySignal,
  getAnomalyDescription,
} from "../../../src/alice-ops/signals.js";
import {
  buildAliceOperatorControlDecision,
  getControlActionDescription,
} from "../../../src/alice-ops/controls.js";
import {
  applyAliceDegradeMode,
} from "../../../src/alice-ops/degrade.js";
import {
  applyAliceDisableMode,
} from "../../../src/alice-ops/disable.js";
import {
  applyAliceHoldMode,
  applyAliceResumeMode,
} from "../../../src/alice-ops/hold.js";
import {
  detectAliceOperationalAnomalies,
  hasCriticalAnomalies,
  hasMediumAnomalies,
  getAnomalyCount,
  getHealthImpactFromAnomalies,
  getStateImpactFromAnomalies,
} from "../../../src/alice-ops/anomalies.js";
import {
  prepareAliceLiveOperationsState,
} from "../../../src/alice-ops/adapter.js";

// Auto-registered via builtin import
const ADAPTER = aliceLiveOpsAdapter;

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

test("builtin live ops adapter loads", () => {
  assert.ok(ADAPTER);
  assert.equal(ADAPTER.adapterId, "alice_live_operations_v1");
  assert.equal(ADAPTER.version, "1.0.0");
});

test("builtin has all feature flags", () => {
  assert.equal(ADAPTER.supportsOperationalState, true);
  assert.equal(ADAPTER.supportsLiveHealthSnapshot, true);
  assert.equal(ADAPTER.supportsOperatorControls, true);
  assert.equal(ADAPTER.supportsDegradeMode, true);
  assert.equal(ADAPTER.supportsDisableMode, true);
  assert.equal(ADAPTER.supportsAnomalySignals, true);
});

// ── Validation ──
console.log("\nValidation:");

test("builtin adapter validates with no errors", () => {
  const errors = validateAliceLiveOpsAdapter(ADAPTER);
  assert.equal(errors.length, 0, `Validation errors: ${JSON.stringify(errors)}`);
});

// ── Operational State ──
console.log("\nOperational state:");

test("buildAliceLiveOperationalState builds valid state", () => {
  const state = buildAliceLiveOperationalState({
    state: "live",
    source: "launch",
  });
  assert.equal(state.state, "live");
  assert.equal(state.source, "launch");
  assert.ok(state.updatedAt);
});

test("getDefaultLiveState returns unknown initial state", () => {
  const state = getDefaultLiveState();
  assert.equal(state.state, "unknown");
  assert.equal(state.source, "launch");
});

test("buildAliceLiveOperationalState with notes", () => {
  const state = buildAliceLiveOperationalState({
    state: "degraded",
    source: "health",
    notes: ["System degraded due to anomaly"],
  });
  assert.equal(state.state, "degraded");
  assert.ok(state.notes);
});

// ── Health Snapshot ──
console.log("\nHealth snapshot:");

test("buildAliceLiveHealthSnapshot returns healthy when all checks pass", () => {
  const health = buildAliceLiveHealthSnapshot({
    ingressAlive: true,
    protocolAlive: true,
    bridgeAlive: true,
    safeFallbackAvailable: true,
  });
  assert.equal(health.health, "healthy");
  assert.equal(health.checks.ingressAlive, true);
  assert.equal(health.checks.safeFallbackAvailable, true);
});

test("buildAliceLiveHealthSnapshot returns degraded when fallback unavailable", () => {
  const health = buildAliceLiveHealthSnapshot({
    ingressAlive: true,
    protocolAlive: true,
    bridgeAlive: true,
    safeFallbackAvailable: false,
  });
  assert.equal(health.health, "degraded");
});

test("buildAliceLiveHealthSnapshot returns unknown when critical check fails", () => {
  const health = buildAliceLiveHealthSnapshot({
    ingressAlive: false,
    protocolAlive: true,
    bridgeAlive: true,
    safeFallbackAvailable: true,
  });
  assert.equal(health.health, "unknown");
});

test("getHealthDescription returns description for each health state", () => {
  assert.ok(getHealthDescription("healthy").length > 0);
  assert.ok(getHealthDescription("degraded").length > 0);
  assert.ok(getHealthDescription("unknown").length > 0);
});

// ── Anomaly Signals ──
console.log("\nAnomaly signals:");

test("buildAliceAnomalySignal builds valid signal", () => {
  const signal = buildAliceAnomalySignal({
    severity: "high",
    type: "ingress_unreachable",
  });
  assert.ok(signal.signalId);
  assert.equal(signal.severity, "high");
  assert.equal(signal.type, "ingress_unreachable");
  assert.ok(signal.observedAt);
});

test("getAnomalyDescription returns description for each signal type", () => {
  const signal = buildAliceAnomalySignal({ severity: "high", type: "ingress_unreachable" });
  assert.ok(getAnomalyDescription(signal).length > 0);
});

// ── Operator Controls ──
console.log("\nOperator controls:");

test("buildAliceOperatorControlDecision accepts hold action", () => {
  const decision = buildAliceOperatorControlDecision({
    action: "hold",
    currentState: "live",
  });
  assert.equal(decision.accepted, true);
  assert.equal(decision.resultingState, "held");
});

test("buildAliceOperatorControlDecision accepts degrade action", () => {
  const decision = buildAliceOperatorControlDecision({
    action: "degrade",
    currentState: "live",
  });
  assert.equal(decision.accepted, true);
  assert.equal(decision.resultingState, "degraded");
});

test("buildAliceOperatorControlDecision accepts disable action", () => {
  const decision = buildAliceOperatorControlDecision({
    action: "disable",
    currentState: "live",
  });
  assert.equal(decision.accepted, true);
  assert.equal(decision.resultingState, "disabled");
});

test("buildAliceOperatorControlDecision accepts resume from held", () => {
  const decision = buildAliceOperatorControlDecision({
    action: "resume",
    currentState: "held",
  });
  assert.equal(decision.accepted, true);
  assert.equal(decision.resultingState, "live");
});

test("buildAliceOperatorControlDecision rejects resume from live", () => {
  const decision = buildAliceOperatorControlDecision({
    action: "resume",
    currentState: "live",
  });
  assert.equal(decision.accepted, false);
});

test("buildAliceOperatorControlDecision rejects resume from disabled", () => {
  const decision = buildAliceOperatorControlDecision({
    action: "resume",
    currentState: "disabled",
  });
  assert.equal(decision.accepted, false);
});

test("getControlActionDescription returns description for each action", () => {
  assert.ok(getControlActionDescription("none").length > 0);
  assert.ok(getControlActionDescription("hold").length > 0);
  assert.ok(getControlActionDescription("degrade").length > 0);
  assert.ok(getControlActionDescription("disable").length > 0);
  assert.ok(getControlActionDescription("resume").length > 0);
});

// ── Degrade Mode ──
console.log("\nDegrade mode:");

test("applyAliceDegradeMode transitions to degraded", () => {
  const state = applyAliceDegradeMode({
    currentState: "live",
    reason: "High severity anomaly detected",
  });
  assert.equal(state.state, "degraded");
  assert.equal(state.source, "operator");
});

// ── Disable Mode ──
console.log("\nDisable mode:");

test("applyAliceDisableMode transitions to disabled", () => {
  const state = applyAliceDisableMode({
    currentState: "live",
    reason: "Critical security concern",
  });
  assert.equal(state.state, "disabled");
  assert.equal(state.source, "operator");
});

// ── Hold / Resume ──
console.log("\nHold / Resume:");

test("applyAliceHoldMode transitions to held", () => {
  const state = applyAliceHoldMode({
    currentState: "live",
    reason: "Maintenance window",
  });
  assert.equal(state.state, "held");
  assert.equal(state.source, "operator");
});

test("applyAliceResumeMode succeeds from held state", () => {
  const result = applyAliceResumeMode({
    currentState: "held",
    healthCritical: false,
  });
  assert.equal(result.success, true);
  assert.equal(result.state?.state, "live");
});

test("applyAliceResumeMode succeeds from degraded state", () => {
  const result = applyAliceResumeMode({
    currentState: "degraded",
    healthCritical: false,
  });
  assert.equal(result.success, true);
  assert.equal(result.state?.state, "live");
});

test("applyAliceResumeMode fails from live state", () => {
  const result = applyAliceResumeMode({
    currentState: "live",
    healthCritical: false,
  });
  assert.equal(result.success, false);
});

test("applyAliceResumeMode fails when health is critical", () => {
  const result = applyAliceResumeMode({
    currentState: "held",
    healthCritical: true,
  });
  assert.equal(result.success, false);
});

// ── Anomaly Detection ──
console.log("\nAnomaly detection:");

test("detectAliceOperationalAnomalies detects ingress unreachable", () => {
  const signals = detectAliceOperationalAnomalies({ ingressReachable: false });
  assert.ok(signals.length > 0);
  assert.ok(signals.some((s) => s.type === "ingress_unreachable"));
  assert.ok(signals.some((s) => s.severity === "high"));
});

test("detectAliceOperationalAnomalies detects protocol failure", () => {
  const signals = detectAliceOperationalAnomalies({ protocolHealthy: false });
  assert.ok(signals.length > 0);
  assert.ok(signals.some((s) => s.type === "protocol_failure"));
});

test("detectAliceOperationalAnomalies detects bridge failure", () => {
  const signals = detectAliceOperationalAnomalies({ bridgeHealthy: false });
  assert.ok(signals.length > 0);
  assert.ok(signals.some((s) => s.type === "bridge_failure"));
});

test("detectAliceOperationalAnomalies detects unsafe response path", () => {
  const signals = detectAliceOperationalAnomalies({ safeResponsePathUsed: true });
  assert.ok(signals.length > 0);
  assert.ok(signals.some((s) => s.type === "unsafe_response_path"));
});

test("detectAliceOperationalAnomalies detects repeated fallback (3+)", () => {
  const signals = detectAliceOperationalAnomalies({ repeatedFallbackCount: 3 });
  assert.ok(signals.length > 0);
  assert.ok(signals.some((s) => s.type === "repeated_fallback"));
});

test("detectAliceOperationalAnomalies returns empty for healthy input", () => {
  const signals = detectAliceOperationalAnomalies({
    ingressReachable: true,
    protocolHealthy: true,
    bridgeHealthy: true,
    safeResponsePathUsed: false,
    repeatedFallbackCount: 0,
  });
  assert.equal(signals.length, 0);
});

test("hasCriticalAnomalities returns true for high severity", () => {
  const signals = detectAliceOperationalAnomalies({ ingressReachable: false });
  assert.equal(hasCriticalAnomalies(signals), true);
});

test("hasMediumAnomalies returns true for medium severity", () => {
  const signals = detectAliceOperationalAnomalies({ safeResponsePathUsed: true });
  assert.equal(hasMediumAnomalies(signals), true);
});

test("getAnomalyCount returns correct counts", () => {
  const signals = detectAliceOperationalAnomalies({
    ingressReachable: false,
    safeResponsePathUsed: true,
  });
  const counts = getAnomalyCount(signals);
  assert.equal(counts.high, 1);
  assert.equal(counts.medium, 1);
  assert.equal(counts.low, 0);
});

test("getHealthImpactFromAnomalies returns unknown for critical anomalies", () => {
  const signals = detectAliceOperationalAnomalies({ ingressReachable: false });
  assert.equal(getHealthImpactFromAnomalies(signals), "unknown");
});

test("getHealthImpactFromAnomalies returns degraded for medium anomalies", () => {
  const signals = detectAliceOperationalAnomalies({ safeResponsePathUsed: true });
  assert.equal(getHealthImpactFromAnomalies(signals), "degraded");
});

test("getHealthImpactFromAnomalies returns healthy for no anomalies", () => {
  const signals = detectAliceOperationalAnomalies({});
  assert.equal(getHealthImpactFromAnomalies(signals), "healthy");
});

test("getStateImpactFromAnomalies degrades on critical anomalies", () => {
  const signals = detectAliceOperationalAnomalies({ ingressReachable: false });
  assert.equal(getStateImpactFromAnomalies(signals, "live"), "degraded");
});

test("getStateImpactFromAnomalies respects held state", () => {
  const signals = detectAliceOperationalAnomalies({ ingressReachable: false });
  assert.equal(getStateImpactFromAnomalies(signals, "held"), "held");
});

test("getStateImpactFromAnomalies respects disabled state", () => {
  const signals = detectAliceOperationalAnomalies({ ingressReachable: false });
  assert.equal(getStateImpactFromAnomalies(signals, "disabled"), "disabled");
});

// ── Main Handler ──
console.log("\nMain handler:");

test("prepareAliceLiveOperationsState returns complete result for healthy state", () => {
  const result = prepareAliceLiveOperationsState({
    currentState: "live",
    healthInput: {
      ingressAlive: true,
      protocolAlive: true,
      bridgeAlive: true,
      safeFallbackAvailable: true,
    },
  });

  assert.ok(result.operationalState);
  assert.ok(result.health);
  assert.ok(result.anomalies);
  assert.ok(result.controlDecision);
  assert.ok(result.resultingState);
  assert.equal(result.health.health, "healthy");
  assert.equal(result.anomalies.length, 0);
});

test("prepareAliceLiveOperationsState detects anomalies and degrades state", () => {
  const result = prepareAliceLiveOperationsState({
    currentState: "live",
    anomalyInput: { ingressReachable: false },
  });

  assert.ok(result.anomalies.length > 0);
  assert.equal(result.resultingState.state, "degraded");
});

test("prepareAliceLiveOperationsState applies hold control action", () => {
  const result = prepareAliceLiveOperationsState({
    currentState: "live",
    controlAction: "hold",
  });

  assert.equal(result.controlDecision.accepted, true);
  assert.equal(result.resultingState.state, "held");
});

test("prepareAliceLiveOperationsState applies disable control action", () => {
  const result = prepareAliceLiveOperationsState({
    currentState: "live",
    controlAction: "disable",
  });

  assert.equal(result.controlDecision.accepted, true);
  assert.equal(result.resultingState.state, "disabled");
});

// ── Selectors ──
console.log("\nSelectors:");

test("getAliceLiveOpsAdapter returns adapter", () => {
  const adapter = getAliceLiveOpsAdapter();
  assert.ok(adapter);
  assert.equal(adapter!.adapterId, "alice_live_operations_v1");
});

test("supportsOperationalState returns true", () => {
  assert.equal(supportsOperationalState(), true);
});

test("supportsLiveHealthSnapshot returns true", () => {
  assert.equal(supportsLiveHealthSnapshot(), true);
});

test("supportsOperatorControls returns true", () => {
  assert.equal(supportsOperatorControls(), true);
});

test("supportsDegradeMode returns true", () => {
  assert.equal(supportsDegradeMode(), true);
});

test("supportsDisableMode returns true", () => {
  assert.equal(supportsDisableMode(), true);
});

test("supportsAnomalySignals returns true", () => {
  assert.equal(supportsAnomalySignals(), true);
});

test("getAdapterVersion returns 1.0.0", () => {
  assert.equal(getAdapterVersion(), "1.0.0");
});

test("getAdapterId returns alice_live_operations_v1", () => {
  assert.equal(getAdapterId(), "alice_live_operations_v1");
});

// ── Sanity Checks ──
console.log("\nSanity checks:");

test("no healthy if critical anomalies present", () => {
  const result = prepareAliceLiveOperationsState({
    currentState: "live",
    anomalyInput: { ingressReachable: false },
  });
  assert.notEqual(result.health.health, "healthy");
});

test("no fake live if disabled", () => {
  const state = applyAliceDisableMode({ currentState: "live" });
  assert.notEqual(state.state, "live");
});

test("no resume if blocked (healthCritical=true)", () => {
  const result = applyAliceResumeMode({
    currentState: "held",
    healthCritical: true,
  });
  assert.equal(result.success, false);
});

test("degrade preserves bounded availability", () => {
  const state = applyAliceDegradeMode({ currentState: "live" });
  assert.equal(state.state, "degraded");
  assert.equal(state.source, "operator");
  assert.ok(state.updatedAt);
});

// ── Results ──
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
