import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createCrisisEventsRepo, createContinuityModesRepo, createRecoveryAttemptsRepo, createResilienceAuditRepo } from "../../packages/runtime-resilience-core/src/storage/sqlite/resilienceRepo.js";
import { createResilienceApi } from "../../packages/runtime-resilience-core/src/api/resilienceApi.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.then(() => { passed++; console.log(`  ✓ ${name}`); }).catch((e) => { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); });
    }
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`  ✗ ${name}\n    ${e.message}`);
  }
}

async function runTests() {
  const db = new Database(":memory:");
  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "../../packages/runtime-resilience-core/src/storage/sqlite/schema.sql");
  db.exec(readFileSync(schemaPath, "utf-8"));

  const crisisEventsRepo = createCrisisEventsRepo(db);
  const continuityModesRepo = createContinuityModesRepo(db);
  const recoveryAttemptsRepo = createRecoveryAttemptsRepo(db);
  const resilienceAuditRepo = createResilienceAuditRepo(db);

  const api = createResilienceApi({
    crisisEventsRepo,
    continuityModesRepo,
    recoveryAttemptsRepo,
    resilienceAuditRepo,
    simulationsRepo: { saveSimulation: () => {} },
    externalRechecksRepo: { saveRecheck: () => {} },
  });

  console.log("\nIntegration: Crisis Requires Declaration:");

  await test("crisis event recorded and declared", () => {
    const event = api.recordCrisisEvent({
      crisis_type: "transport_outage",
      severity: "high",
      affected_scope: "zone",
      affected_ids: ["zone_1"],
      detected_by: "system",
    });
    assert.ok(event.crisis_id);
    assert.equal(event.status, "open");

    const result = api.declareCrisis(event.crisis_id);
    assert.equal(result.declared, true);
  });

  await test("already declared crisis cannot be re-declared", () => {
    const event = api.recordCrisisEvent({
      crisis_type: "dependency_loss",
      severity: "medium",
      affected_scope: "route",
      affected_ids: ["route_1"],
      detected_by: "system",
    });
    api.declareCrisis(event.crisis_id);
    const result = api.declareCrisis(event.crisis_id);
    assert.equal(result.declared, false);
    assert.ok(result.error?.includes("contained"));
  });

  console.log("\nIntegration: Dependency Loss Triggers Degraded Mode:");

  await test("continuity mode activated after crisis", () => {
    const event = api.recordCrisisEvent({
      crisis_type: "dependency_loss",
      severity: "high",
      affected_scope: "zone",
      affected_ids: ["zone_2"],
      detected_by: "system",
    });
    api.declareCrisis(event.crisis_id);
    const mode = api.activateContinuityMode({
      scope_type: "zone",
      scope_id: "zone_2",
      mode: "degraded",
      reason: "Dependency loss detected",
      activated_by: "system",
    });
    assert.equal(mode.current_mode, "degraded");
    assert.equal(mode.scope_id, "zone_2");
  });

  console.log("\nIntegration: Sovereign Fallback Preserves Governance:");

  await test("sovereign fallback profile created with surviving capabilities", () => {
    const event = api.recordCrisisEvent({
      crisis_type: "federation_disconnect",
      severity: "critical",
      affected_scope: "federation",
      affected_ids: ["fed_1"],
      detected_by: "system",
    });
    api.declareCrisis(event.crisis_id);
    const profile = api.enterSovereignFallback({
      scope_id: "fed_1",
      surviving_capabilities: ["local_routing", "local_audit", "local_review"],
      excluded_dependencies: ["external_api", "federation_coordination"],
      local_policy_baseline: "sovereign_minimal",
      activated_by: "crisis_owner",
    });
    assert.ok(profile.profile_id);
    assert.equal(profile.surviving_capabilities.length, 3);
    assert.equal(profile.excluded_dependencies.length, 2);
  });

  console.log("\nIntegration: Recovery Failure Rolls Back:");

  await test("recovery attempt tracked and rolled back on failure", () => {
    const event = api.recordCrisisEvent({
      crisis_type: "transport_outage",
      severity: "high",
      affected_scope: "zone",
      affected_ids: ["zone_3"],
      detected_by: "system",
    });
    api.declareCrisis(event.crisis_id);
    api.activateContinuityMode({
      crisis_id: event.crisis_id,
      scope_type: "global",
      scope_id: "global",
      mode: "restricted_external",
      reason: "Compliance Emergency",
      activated_by: "safety_admin",
    });
    const recovery = api.beginRecoveryAttempt({
      crisis_id: event.crisis_id,
      scope_type: "zone",
      scope_id: "zone_3",
    });
    assert.equal(recovery.status, "running");

    const rollbackResult = api.rollbackRecovery(recovery.recovery_id, event.crisis_id, "Recovery caused instability");
    assert.equal(rollbackResult.rolled_back, true);

    const audit = api.getResilienceAuditTrail(event.crisis_id);
    assert.ok(audit.some((e) => e.event_type === "recovery_rolled_back"));
  });

  console.log("\nIntegration: Crisis Audit Survives Central Loss:");

  await test("audit trail contains full crisis lifecycle", () => {
    const event = api.recordCrisisEvent({
      crisis_type: "compliance_emergency",
      severity: "critical",
      affected_scope: "global",
      affected_ids: ["global"],
      detected_by: "compliance_monitor",
    });
    api.declareCrisis(event.crisis_id);
    api.activateContinuityMode({
      crisis_id: event.crisis_id,
      scope_type: "global",
      scope_id: "global",
      mode: "restricted_external",
      reason: "Compliance emergency",
      activated_by: "safety_admin",
    });
    const recovery = api.beginRecoveryAttempt({
      crisis_id: event.crisis_id,
      scope_type: "global",
      scope_id: "global",
    });
    assert.equal(recovery.status, "running");
    const completeResult = api.completeRecovery(recovery.recovery_id, event.crisis_id);
    assert.equal(completeResult.completed, true, `completeRecovery failed: ${completeResult.error}`);

    const audit = api.getResilienceAuditTrail(event.crisis_id);
    const eventTypes = audit.map((e: any) => e.event_type);
    assert.ok(eventTypes.includes("crisis_detected"), `Missing crisis_detected. Events: ${eventTypes.join(", ")}`);
    assert.ok(eventTypes.includes("crisis_declared"), `Missing crisis_declared. Events: ${eventTypes.join(", ")}`);
    assert.ok(eventTypes.includes("continuity_mode_activated"), `Missing continuity_mode_activated. Events: ${eventTypes.join(", ")}`);
    assert.ok(eventTypes.includes("recovery_started"), `Missing recovery_started. Events: ${eventTypes.join(", ")}`);
    assert.ok(eventTypes.includes("recovery_completed"), `Missing recovery_completed. Events: ${eventTypes.join(", ")}`);
  });

  console.log("\nIntegration: External Re-enable Requires Recheck:");

  await test("external re-enable blocked without trust/compliance reverification", () => {
    const event = api.recordCrisisEvent({
      crisis_type: "external_contract_revocation",
      severity: "high",
      affected_scope: "federation",
      affected_ids: ["fed_2"],
      detected_by: "compliance_monitor",
    });
    // Attempt to re-enable without reverification should throw
    assert.throws(() => api.recordExternalRecheck({
      crisis_id: event.crisis_id,
      external_party_id: "partner_1",
      scope_reenabled: "external_api",
      trust_reverified: false,
      compliance_reverified: true,
      rechecked_by: "zone_owner",
    }), /requires both trust and compliance reverification/);
  });

  await test("external re-enable succeeds with full reverification", () => {
    const event = api.recordCrisisEvent({
      crisis_type: "external_contract_revocation",
      severity: "medium",
      affected_scope: "federation",
      affected_ids: ["fed_3"],
      detected_by: "system",
    });
    const recheck = api.recordExternalRecheck({
      crisis_id: event.crisis_id,
      external_party_id: "partner_2",
      scope_reenabled: "external_api",
      trust_reverified: true,
      compliance_reverified: true,
      rechecked_by: "external_compliance_admin",
    });
    assert.ok(recheck.recheck_id);
    assert.equal(recheck.trust_reverified, true);
    assert.equal(recheck.compliance_reverified, true);
  });

  console.log("\nIntegration: Simulation Proves Continuity:");

  await test("crisis simulation proves continuity feasibility", () => {
    const result = api.simulateCrisisScenario({
      scenario_type: "transport_outage",
      scope_type: "zone",
      scope_id: "zone_sim_1",
      current_capabilities: ["local_routing", "local_audit", "local_review", "local_rollback"],
      current_dependencies: ["external_api"],
      has_local_audit: true,
      has_local_policy: true,
    });
    assert.ok(result.simulation_id);
    assert.equal(result.continuity_feasible, true);
    assert.ok(result.surviving_capabilities.length >= 2);
    assert.equal(result.recovery_ready, true);
    assert.equal(result.audit_survivable, true);
  });

  await test("crisis simulation detects continuity infeasibility", () => {
    const result = api.simulateCrisisScenario({
      scenario_type: "federation_disconnect",
      scope_type: "zone",
      scope_id: "zone_sim_2",
      current_capabilities: ["external_api"],
      current_dependencies: ["external_api", "federation_coordination"],
      has_local_audit: false,
      has_local_policy: false,
    });
    assert.equal(result.continuity_feasible, false);
    assert.ok(result.policy_breach_risks.length > 0);
    assert.equal(result.recovery_ready, false);
    assert.equal(result.audit_survivable, false);
  });

  console.log("\nIntegration: Unsafe Crisis Action Blocked:");

  await test("crisis action without authority blocked", () => {
    const result = api.validateCrisisAuthority({
      action: "enter_sovereign_fallback",
      actor_roles: ["observer"],
      required_roles: ["crisis_owner", "federation_owner", "safety_admin"],
    });
    assert.equal(result.authorized, false);
    assert.ok(result.error?.includes("requires one of"));
  });

  await test("crisis action with proper authority authorized", () => {
    const result = api.validateCrisisAuthority({
      action: "enter_sovereign_fallback",
      actor_roles: ["crisis_owner", "observer"],
      required_roles: ["crisis_owner", "federation_owner", "safety_admin"],
    });
    assert.equal(result.authorized, true);
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
