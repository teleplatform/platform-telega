// Alice External Launch / Go-Live Pack v1.0 — Unit Tests
// Run with: npx tsx tests/unit/alice-launch/alice-external-launch-go-live-pack.test.ts

import assert from "node:assert/strict";
import { aliceGoLiveAdapter } from "../../../src/alice-launch/builtin.js";
import { validateAliceGoLiveAdapter } from "../../../src/alice-launch/validators.js";
import {
  getAliceGoLiveAdapter,
  supportsLaunchPlan,
  supportsGateValidation,
  supportsSmokeChecks,
  supportsControlledModes,
  supportsRollbackDiscipline,
  supportsLaunchOutcomeTracking,
  getAdapterVersion,
  getAdapterId,
} from "../../../src/alice-launch/selectors.js";
import {
  buildAliceLaunchPlan,
  serializeAliceLaunchPlan,
  parseAliceLaunchPlan,
  getDefaultLaunchPlan,
} from "../../../src/alice-launch/plan.js";
import {
  runAliceGoLiveGates,
} from "../../../src/alice-launch/gates.js";
import {
  runAliceLaunchSmokeChecks,
} from "../../../src/alice-launch/smoke.js";
import {
  resolveAliceLaunchMode,
  isControlledLiveMode,
  isInternalOnlyMode,
  isDryRunMode,
  getModeDescription,
} from "../../../src/alice-launch/modes.js";
import {
  buildAliceLaunchHealthSnapshot,
  getHealthDescription,
} from "../../../src/alice-launch/health.js";
import {
  buildAliceRollbackDecision,
  applyAliceLaunchHold,
  applyAliceRollback,
} from "../../../src/alice-launch/rollback.js";
import {
  buildAliceLaunchOutcome,
  getLaunchStateDescription,
} from "../../../src/alice-launch/outcomes.js";
import {
  prepareAliceExternalLaunch,
} from "../../../src/alice-launch/adapter.js";
import type { AliceLaunchPlan } from "../../../src/alice-launch/types.js";

// Auto-registered via builtin import
const ADAPTER = aliceGoLiveAdapter;

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

test("builtin go-live adapter loads", () => {
  assert.ok(ADAPTER);
  assert.equal(ADAPTER.adapterId, "alice_external_launch_v1");
  assert.equal(ADAPTER.version, "1.0.0");
});

test("builtin has all feature flags", () => {
  assert.equal(ADAPTER.supportsLaunchPlan, true);
  assert.equal(ADAPTER.supportsGateValidation, true);
  assert.equal(ADAPTER.supportsSmokeChecks, true);
  assert.equal(ADAPTER.supportsControlledModes, true);
  assert.equal(ADAPTER.supportsRollbackDiscipline, true);
  assert.equal(ADAPTER.supportsLaunchOutcomeTracking, true);
});

// ── Validation ──
console.log("\nValidation:");

test("builtin adapter validates with no errors", () => {
  const errors = validateAliceGoLiveAdapter(ADAPTER);
  assert.equal(errors.length, 0, `Validation errors: ${JSON.stringify(errors)}`);
});

// ── Launch Plan ──
console.log("\nLaunch plan:");

test("buildAliceLaunchPlan builds valid plan", () => {
  const plan = buildAliceLaunchPlan();
  assert.ok(plan.launchId);
  assert.equal(plan.skillId, "arisha_alice_skill_v1");
  assert.equal(plan.mode, "dry_run");
  assert.equal(plan.targetSurface, "alice");
  assert.equal(plan.requiresReadinessPass, true);
  assert.equal(plan.requiresSmokePass, true);
  assert.equal(plan.allowsRollback, true);
  assert.ok(plan.createdAt);
});

test("buildAliceLaunchPlan with custom input", () => {
  const plan = buildAliceLaunchPlan({
    mode: "controlled_live",
    allowsRollback: false,
    notes: ["Custom launch"],
  });
  assert.equal(plan.mode, "controlled_live");
  assert.equal(plan.allowsRollback, false);
  assert.deepEqual(plan.notes, ["Custom launch"]);
});

test("getDefaultLaunchPlan returns default plan", () => {
  const plan = getDefaultLaunchPlan();
  assert.equal(plan.mode, "dry_run");
});

test("serializeAliceLaunchPlan produces valid JSON", () => {
  const plan = buildAliceLaunchPlan();
  const json = serializeAliceLaunchPlan(plan);
  assert.ok(json.length > 0);
  const parsed = JSON.parse(json);
  assert.equal(parsed.skillId, "arisha_alice_skill_v1");
});

test("parseAliceLaunchPlan parses valid JSON", () => {
  const plan = buildAliceLaunchPlan({ mode: "internal_only" });
  const json = serializeAliceLaunchPlan(plan);
  const parsed = parseAliceLaunchPlan(json);
  assert.ok(parsed);
  assert.equal(parsed!.mode, "internal_only");
});

test("parseAliceLaunchPlan returns null for invalid skillId", () => {
  const json = JSON.stringify({ skillId: "invalid", mode: "dry_run" });
  assert.equal(parseAliceLaunchPlan(json), null);
});

test("parseAliceLaunchPlan returns null for invalid mode", () => {
  const json = JSON.stringify({ skillId: "arisha_alice_skill_v1", mode: "invalid" });
  assert.equal(parseAliceLaunchPlan(json), null);
});

test("parseAliceLaunchPlan returns null for invalid JSON", () => {
  assert.equal(parseAliceLaunchPlan("not json"), null);
});

// ── Gate Checks ──
console.log("\nGate checks:");

test("runAliceGoLiveGates passes when all checks true", () => {
  const result = runAliceGoLiveGates({
    publishReadinessPassed: true,
    endpointDeclared: true,
    ingressHardeningEnabled: true,
    protocolAdapterReady: true,
    webhookRouteReady: true,
  });
  assert.equal(result.gatesPassed, true);
  assert.ok(!result.blockers);
});

test("runAliceGoLiveGates fails when publish readiness fails", () => {
  const result = runAliceGoLiveGates({ publishReadinessPassed: false });
  assert.equal(result.gatesPassed, false);
  assert.ok(result.blockers?.some((b) => b.includes("Publish readiness")));
});

test("runAliceGoLiveGates fails when endpoint not declared", () => {
  const result = runAliceGoLiveGates({ endpointDeclared: false });
  assert.equal(result.gatesPassed, false);
  assert.ok(result.blockers?.some((b) => b.includes("endpoint")));
});

// ── Smoke Checks ──
console.log("\nSmoke checks:");

test("runAliceLaunchSmokeChecks passes when all checks true", () => {
  const result = runAliceLaunchSmokeChecks({
    ingressReachable: true,
    protocolMappingWorks: true,
    bridgeAdapterWorks: true,
    safeErrorPathWorks: true,
  });
  assert.equal(result.smokePassed, true);
  assert.ok(!result.blockers);
});

test("runAliceLaunchSmokeChecks fails when ingress unreachable", () => {
  const result = runAliceLaunchSmokeChecks({ ingressReachable: false });
  assert.equal(result.smokePassed, false);
  assert.ok(result.blockers?.some((b) => b.includes("Ingress")));
});

// ── Launch Modes ──
console.log("\nLaunch modes:");

test("resolveAliceLaunchMode defaults to dry_run", () => {
  assert.equal(resolveAliceLaunchMode(), "dry_run");
});

test("resolveAliceLaunchMode downgrades to dry_run if gates failed", () => {
  assert.equal(resolveAliceLaunchMode({ mode: "controlled_live", gatesPassed: false }), "dry_run");
});

test("resolveAliceLaunchMode downgrades to dry_run if smoke failed", () => {
  assert.equal(resolveAliceLaunchMode({ mode: "controlled_live", smokePassed: false }), "dry_run");
});

test("resolveAliceLaunchMode allows controlled_live if gates and smoke passed", () => {
  assert.equal(resolveAliceLaunchMode({ mode: "controlled_live", gatesPassed: true, smokePassed: true }), "controlled_live");
});

test("isControlledLiveMode returns true only for controlled_live", () => {
  assert.equal(isControlledLiveMode("controlled_live"), true);
  assert.equal(isControlledLiveMode("dry_run"), false);
  assert.equal(isControlledLiveMode("internal_only"), false);
});

test("isInternalOnlyMode returns true only for internal_only", () => {
  assert.equal(isInternalOnlyMode("internal_only"), true);
  assert.equal(isInternalOnlyMode("dry_run"), false);
});

test("isDryRunMode returns true only for dry_run", () => {
  assert.equal(isDryRunMode("dry_run"), true);
  assert.equal(isDryRunMode("controlled_live"), false);
});

test("getModeDescription returns description for each mode", () => {
  assert.ok(getModeDescription("dry_run").length > 0);
  assert.ok(getModeDescription("internal_only").length > 0);
  assert.ok(getModeDescription("controlled_live").length > 0);
});

// ── Health Snapshot ──
console.log("\nHealth snapshot:");

test("buildAliceLaunchHealthSnapshot returns healthy for live with gates+smoke", () => {
  const health = buildAliceLaunchHealthSnapshot({
    launchState: "live",
    gatesPassed: true,
    smokePassed: true,
  });
  assert.equal(health.state, "healthy");
  assert.equal(health.checksPassed, 2);
  assert.equal(health.checksFailed, 0);
});

test("buildAliceLaunchHealthSnapshot returns degraded for held", () => {
  const health = buildAliceLaunchHealthSnapshot({
    launchState: "held",
  });
  assert.equal(health.state, "degraded");
});

test("buildAliceLaunchHealthSnapshot returns degraded for rolled_back", () => {
  const health = buildAliceLaunchHealthSnapshot({
    launchState: "rolled_back",
  });
  assert.equal(health.state, "degraded");
});

test("buildAliceLaunchHealthSnapshot returns unknown for failed", () => {
  const health = buildAliceLaunchHealthSnapshot({
    launchState: "failed",
  });
  assert.equal(health.state, "unknown");
});

test("getHealthDescription returns description for each state", () => {
  assert.ok(getHealthDescription("healthy").length > 0);
  assert.ok(getHealthDescription("degraded").length > 0);
  assert.ok(getHealthDescription("unknown").length > 0);
});

// ── Rollback / Hold ──
console.log("\nRollback / Hold:");

test("buildAliceRollbackDecision triggers rollback for failed state", () => {
  const decision = buildAliceRollbackDecision({ launchState: "failed", reason: "Critical failure" });
  assert.equal(decision.shouldRollback, true);
  assert.equal(decision.targetState, "rolled_back");
});

test("buildAliceRollbackDecision triggers hold for gated state", () => {
  const decision = buildAliceRollbackDecision({ launchState: "gated" });
  assert.equal(decision.shouldRollback, false);
  assert.equal(decision.targetState, "held");
});

test("applyAliceLaunchHold creates held outcome", () => {
  const outcome = applyAliceLaunchHold({ currentLaunchState: "live", reason: "Manual hold" });
  assert.equal(outcome.launchAccepted, false);
  assert.equal(outcome.launchState, "held");
});

test("applyAliceRollback creates rolled_back outcome", () => {
  const outcome = applyAliceRollback({ currentLaunchState: "live", reason: "Critical issue" });
  assert.equal(outcome.launchAccepted, false);
  assert.equal(outcome.launchState, "rolled_back");
});

// ── Launch Outcome ──
console.log("\nLaunch outcome:");

test("buildAliceLaunchOutcome returns gated when gates failed", () => {
  const plan = buildAliceLaunchPlan({ mode: "controlled_live" });
  const gates = runAliceGoLiveGates({ publishReadinessPassed: false });
  const smoke = runAliceLaunchSmokeChecks();
  const outcome = buildAliceLaunchOutcome({ plan, gates, smoke });
  assert.equal(outcome.launchAccepted, false);
  assert.equal(outcome.launchState, "gated");
});

test("buildAliceLaunchOutcome returns smoke_failed when smoke failed", () => {
  const plan = buildAliceLaunchPlan({ mode: "controlled_live" });
  const gates = runAliceGoLiveGates();
  const smoke = runAliceLaunchSmokeChecks({ ingressReachable: false });
  const outcome = buildAliceLaunchOutcome({ plan, gates, smoke });
  assert.equal(outcome.launchAccepted, false);
  assert.equal(outcome.launchState, "smoke_failed");
});

test("buildAliceLaunchOutcome returns live for controlled_live with gates+smoke passed", () => {
  const plan = buildAliceLaunchPlan({ mode: "controlled_live" });
  const gates = runAliceGoLiveGates();
  const smoke = runAliceLaunchSmokeChecks();
  const outcome = buildAliceLaunchOutcome({ plan, gates, smoke });
  assert.equal(outcome.launchAccepted, true);
  assert.equal(outcome.launchState, "live");
});

test("buildAliceLaunchOutcome returns not_started for dry_run", () => {
  const plan = buildAliceLaunchPlan({ mode: "dry_run" });
  const gates = runAliceGoLiveGates();
  const smoke = runAliceLaunchSmokeChecks();
  const outcome = buildAliceLaunchOutcome({ plan, gates, smoke });
  assert.equal(outcome.launchAccepted, false);
  assert.equal(outcome.launchState, "not_started");
});

test("getLaunchStateDescription returns description for each state", () => {
  assert.ok(getLaunchStateDescription("not_started").length > 0);
  assert.ok(getLaunchStateDescription("gated").length > 0);
  assert.ok(getLaunchStateDescription("live").length > 0);
  assert.ok(getLaunchStateDescription("held").length > 0);
  assert.ok(getLaunchStateDescription("rolled_back").length > 0);
  assert.ok(getLaunchStateDescription("failed").length > 0);
});

// ── Main Handler ──
console.log("\nMain handler:");

test("prepareAliceExternalLaunch returns complete result for dry_run", () => {
  const result = prepareAliceExternalLaunch({ mode: "dry_run" });
  assert.ok(result.plan);
  assert.ok(result.gates);
  assert.ok(result.smoke);
  assert.ok(result.outcome);
  assert.ok(result.health);
  assert.ok(result.rollbackDecision);
  assert.equal(result.outcome.launchState, "not_started");
});

test("prepareAliceExternalLaunch returns live for controlled_live with all checks passing", () => {
  const result = prepareAliceExternalLaunch({ mode: "controlled_live" });
  assert.equal(result.outcome.launchAccepted, true);
  assert.equal(result.outcome.launchState, "live");
});

test("prepareAliceExternalLaunch returns gated when gates fail", () => {
  const result = prepareAliceExternalLaunch({
    mode: "controlled_live",
    gates: { publishReadinessPassed: false },
  });
  assert.equal(result.outcome.launchAccepted, false);
  assert.equal(result.outcome.launchState, "gated");
});

test("prepareAliceExternalLaunch returns smoke_failed when smoke fails", () => {
  const result = prepareAliceExternalLaunch({
    mode: "controlled_live",
    smoke: { ingressReachable: false },
  });
  assert.equal(result.outcome.launchAccepted, false);
  assert.equal(result.outcome.launchState, "smoke_failed");
});

// ── Selectors ──
console.log("\nSelectors:");

test("getAliceGoLiveAdapter returns adapter", () => {
  const adapter = getAliceGoLiveAdapter();
  assert.ok(adapter);
  assert.equal(adapter!.adapterId, "alice_external_launch_v1");
});

test("supportsLaunchPlan returns true", () => {
  assert.equal(supportsLaunchPlan(), true);
});

test("supportsGateValidation returns true", () => {
  assert.equal(supportsGateValidation(), true);
});

test("supportsSmokeChecks returns true", () => {
  assert.equal(supportsSmokeChecks(), true);
});

test("supportsControlledModes returns true", () => {
  assert.equal(supportsControlledModes(), true);
});

test("supportsRollbackDiscipline returns true", () => {
  assert.equal(supportsRollbackDiscipline(), true);
});

test("supportsLaunchOutcomeTracking returns true", () => {
  assert.equal(supportsLaunchOutcomeTracking(), true);
});

test("getAdapterVersion returns 1.0.0", () => {
  assert.equal(getAdapterVersion(), "1.0.0");
});

test("getAdapterId returns alice_external_launch_v1", () => {
  assert.equal(getAdapterId(), "alice_external_launch_v1");
});

// ── Sanity Checks ──
console.log("\nSanity checks:");

test("no live without gates", () => {
  const result = prepareAliceExternalLaunch({
    mode: "controlled_live",
    gates: { publishReadinessPassed: false },
  });
  assert.notEqual(result.outcome.launchState, "live");
});

test("no live without smoke", () => {
  const result = prepareAliceExternalLaunch({
    mode: "controlled_live",
    smoke: { ingressReachable: false },
  });
  assert.notEqual(result.outcome.launchState, "live");
});

test("no fake live when blockers exist", () => {
  const result = prepareAliceExternalLaunch({
    mode: "controlled_live",
    gates: { endpointDeclared: false },
  });
  assert.equal(result.outcome.launchAccepted, false);
});

test("rollback path exists on failed launch", () => {
  const result = prepareAliceExternalLaunch({
    mode: "controlled_live",
    gates: { publishReadinessPassed: false },
  });
  assert.ok(result.rollbackDecision);
  // When gates fail, state is gated, not failed, so rollback decision is hold
  assert.ok(result.rollbackDecision.targetState === "held" || result.rollbackDecision.targetState === "rolled_back");
});

// ── Results ──
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
