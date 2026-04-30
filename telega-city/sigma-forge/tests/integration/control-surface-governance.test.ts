import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createControlRepos } from "../../packages/runtime-control-core/src/storage/sqlite/controlRepo.js";
import { createControlApi } from "../../packages/runtime-control-core/src/api/controlApi.js";

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
  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "../../packages/runtime-control-core/src/storage/sqlite/schema.sql");
  db.exec(readFileSync(schemaPath, "utf-8"));

  const repos = createControlRepos(db);
  const api = createControlApi({ repos });

  console.log("\nIntegration: Read-Only View Does Not Mutate:");

  await test("truth view generation does not mutate system state", () => {
    const view = api.getTruthView({
      view_type: "runtime",
      scope_type: "zone",
      scope_id: "zone_1",
      state_summary: "Running normally",
      provenance_refs: ["evidence_1"],
      active_constraints: ["constraint_1"],
      recent_decisions: ["decision_1"],
    });
    assert.ok(view.view_id);
    assert.equal(view.view_type, "runtime");
    // Verify no mutations occurred - only read/view operations
    const audit = api.getControlAuditTrail();
    assert.ok(audit.some((e) => e.event_type === "truth_view_generated"));
    assert.ok(!audit.some((e) => e.event_type === "guarded_action_executed"));
  });

  console.log("\nIntegration: Critical Action Requires Guard:");

  await test("critical write action blocked without proper role", () => {
    api.setupGuardedActionPolicy({
      action_type: "activate_strategy",
      required_roles: ["strategy_admin", "federation_owner"],
      confirmation_mode: "elevated",
      blocked_if_constraints: ["constitutional_violation"],
    });
    const result = api.executeGuardedWriteAction({
      action_type: "activate_strategy",
      target_type: "strategy",
      target_id: "strategy_1",
      actor_id: "user_1",
      actor_role: "observer",
    });
    assert.equal(result.executed, false);
    assert.ok(result.error?.includes("requires one of"));
  });

  await test("critical write action succeeds with proper role", () => {
    const result = api.executeGuardedWriteAction({
      action_type: "activate_strategy",
      target_type: "strategy",
      target_id: "strategy_1",
      actor_id: "user_2",
      actor_role: "strategy_admin",
    });
    assert.equal(result.executed, true);
  });

  console.log("\nIntegration: Digest Must Be Trace-Linked:");

  await test("legibility digest without evidence refs rejected", () => {
    const result = api.generateLegibilityDigest({
      target_type: "strategy",
      target_id: "strategy_1",
      summary: "Strategy overview",
      evidence_refs: [],
      active_constraints: [],
      pending_actions: [],
      risk_flags: [],
    });
    assert.ok(result.error?.includes("requires evidence refs"));
  });

  await test("decision digest without trace refs rejected", () => {
    const result = api.requestDecisionDigest({
      digest_type: "strategy",
      scope_type: "portfolio",
      scope_id: "portfolio_1",
      title: "Strategy decision",
      summary: "Decision summary",
      what_changed: ["strategy_1"],
      what_blocked: [],
      next_actions: ["activate"],
      what_not_to_touch: ["constitutional_principles"],
      trace_refs: [],
    });
    assert.ok(result.error?.includes("requires trace refs"));
  });

  await test("legibility digest with evidence refs accepted", () => {
    const result = api.generateLegibilityDigest({
      target_type: "strategy",
      target_id: "strategy_1",
      summary: "Strategy overview",
      evidence_refs: ["evidence_1", "evidence_2"],
      active_constraints: ["budget_cap"],
      pending_actions: ["activate"],
      risk_flags: [],
    });
    assert.ok(result.digest.digest_id);
    assert.equal(result.digest.evidence_refs.length, 2);
  });

  console.log("\nIntegration: Operator Intervention Is Audited:");

  await test("operator intervention request is audited", () => {
    const intervention = api.requestOperatorIntervention({
      action_type: "pause_activation",
      target_type: "strategy",
      target_id: "strategy_1",
      actor_id: "operator_1",
      reason: "Detected regression",
      risk_class: "high",
    });
    assert.ok(intervention.intervention_id);
    assert.equal(intervention.status, "requested");

    const audit = api.getControlAuditTrail();
    assert.ok(audit.some((e) => e.event_type === "operator_intervention_requested"));
  });

  await test("operator intervention application is audited", () => {
    const intervention = api.requestOperatorIntervention({
      action_type: "rollback_activation",
      target_type: "strategy",
      target_id: "strategy_2",
      actor_id: "operator_2",
      reason: "Critical failure",
      risk_class: "critical",
    });
    const applyResult = api.applyOperatorIntervention(intervention.intervention_id, "operator_2");
    assert.equal(applyResult.applied, true);

    const audit = api.getControlAuditTrail();
    assert.ok(audit.some((e) => e.event_type === "operator_intervention_applied"));
  });

  console.log("\nIntegration: Human Action Cannot Bypass Constitutional Rule:");

  await test("control surface respects guarded action policies", () => {
    api.setupGuardedActionPolicy({
      action_type: "override_constitutional_principle",
      required_roles: ["constitutional_owner"],
      confirmation_mode: "dual_control",
      blocked_if_constraints: ["constitutional_violation"],
    });
    const result = api.executeGuardedWriteAction({
      action_type: "override_constitutional_principle",
      target_type: "principle",
      target_id: "principle_1",
      actor_id: "user_3",
      actor_role: "observer",
    });
    assert.equal(result.executed, false);
  });

  console.log("\nIntegration: Decision Digest Explainable:");

  await test("decision digest contains trace-linked facts", () => {
    const result = api.requestDecisionDigest({
      digest_type: "governance",
      scope_type: "constitutional",
      scope_id: "constitution_1",
      title: "Constitutional change decision",
      summary: "Principle amended based on new evidence",
      what_changed: ["principle_1"],
      what_blocked: [],
      next_actions: ["review"],
      what_not_to_touch: ["precedence_rules"],
      trace_refs: ["change_1", "evidence_1", "audit_1"],
    });
    assert.ok(result.digest.digest_id);
    assert.equal(result.digest.trace_refs.length, 3);
    assert.ok(result.digest.what_changed.includes("principle_1"));
    assert.ok(result.digest.what_not_to_touch.includes("precedence_rules"));
  });

  console.log("\nIntegration: Crisis Surface Respects Crisis Authority:");

  await test("crisis action without crisis authority blocked", () => {
    const result = api.executeGuardedWriteAction({
      action_type: "declare_crisis",
      target_type: "zone",
      target_id: "zone_1",
      actor_id: "user_4",
      actor_role: "observer",
      crisis_authority: { has_crisis_authority: false, required_roles: ["crisis_owner", "federation_owner"] },
    });
    assert.equal(result.executed, false);
    assert.ok(result.error?.includes("requires crisis authority"));
  });

  await test("crisis action with proper crisis authority succeeds", () => {
    api.setupGuardedActionPolicy({
      action_type: "declare_crisis",
      required_roles: ["crisis_owner"],
      confirmation_mode: "elevated",
      blocked_if_constraints: [],
    });
    const result = api.executeGuardedWriteAction({
      action_type: "declare_crisis",
      target_type: "zone",
      target_id: "zone_1",
      actor_id: "user_5",
      actor_role: "crisis_owner",
      crisis_authority: { has_crisis_authority: true, required_roles: ["crisis_owner", "federation_owner"] },
    });
    assert.equal(result.executed, true);
  });

  console.log("\nIntegration: External Trust Surface Respects Recheck:");

  await test("external re-enable without recheck blocked", () => {
    const result = api.executeGuardedWriteAction({
      action_type: "reenable_external_scope",
      target_type: "external_contract",
      target_id: "contract_1",
      actor_id: "user_6",
      actor_role: "zone_owner",
      external_recheck: { has_valid_recheck: false },
    });
    assert.equal(result.executed, false);
    assert.ok(result.error?.includes("requires valid recheck proof"));
  });

  await test("external re-enable with valid recheck succeeds", () => {
    api.setupGuardedActionPolicy({
      action_type: "reenable_external_scope",
      required_roles: ["zone_owner"],
      confirmation_mode: "single",
      blocked_if_constraints: [],
    });
    const result = api.executeGuardedWriteAction({
      action_type: "reenable_external_scope",
      target_type: "external_contract",
      target_id: "contract_1",
      actor_id: "user_7",
      actor_role: "zone_owner",
      external_recheck: { has_valid_recheck: true, recheck_id: "recheck_1" },
    });
    assert.equal(result.executed, true);
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
