import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createConstitutionalRepos } from "../../packages/runtime-constitutional-core/src/storage/sqlite/constitutionalRepo.js";
import { createConstitutionalApi } from "../../packages/runtime-constitutional-core/src/api/constitutionalApi.js";

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
  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "../../packages/runtime-constitutional-core/src/storage/sqlite/schema.sql");
  db.exec(readFileSync(schemaPath, "utf-8"));

  const repos = createConstitutionalRepos(db);
  const api = createConstitutionalApi({ repos });

  console.log("\nIntegration: Doctrine Requires Principle Link:");

  await test("doctrine without principle or artifact link rejected", () => {
    const result = api.registerDoctrineRecord({
      title: "Unlinked doctrine",
      doctrine_type: "canon",
      linked_principle_ids: [],
      linked_artifacts: [],
      created_by: "system",
    });
    assert.equal(result.doctrine.doctrine_id, undefined);
    assert.ok(result.error?.includes("requires at least one linked principle or artifact"));
  });

  await test("doctrine with principle link accepted", () => {
    const principle = api.createConstitutionalPrinciple({
      title: "Evidence before adaptation",
      description: "All adaptation must be evidence-linked",
      category: "governance",
      precedence_level: 100,
      created_by: "system",
    });
    const result = api.registerDoctrineRecord({
      title: "Adaptation evidence requirement",
      doctrine_type: "governance_rule",
      linked_principle_ids: [principle.principle_id],
      linked_artifacts: [],
      created_by: "system",
    });
    assert.ok(result.doctrine.doctrine_id);
    assert.equal(result.doctrine.linked_principle_ids.length, 1);
  });

  console.log("\nIntegration: Precedence Blocks Lower Conflict:");

  await test("higher precedence wins in conflict resolution", () => {
    api.resolveGovernancePrecedence({
      higher_type: "principle",
      lower_type: "doctrine",
      description: "Principles override doctrines",
    });
    const conflict = api.evaluateGovernanceConflict({
      entity_a_type: "principle",
      entity_a_id: "p1",
      entity_b_type: "doctrine",
      entity_b_id: "d1",
      conflict_description: "Doctrine contradicts principle",
      resolved_by: "system",
    });
    assert.equal(conflict.resolution, "higher_precedence_wins");
    assert.equal(conflict.winner_id, "p1");
  });

  console.log("\nIntegration: Constitutional Change Requires Rationale:");

  await test("change without rationale rejected", () => {
    const result = api.proposeConstitutionalChange({
      target_type: "principle",
      target_id: "p1",
      change_type: "amend",
      rationale: "",
      evidence_refs: ["evidence_1"],
      created_by: "system",
    });
    assert.ok(result.error?.includes("requires rationale"));
  });

  await test("change without evidence rejected", () => {
    const result = api.proposeConstitutionalChange({
      target_type: "principle",
      target_id: "p1",
      change_type: "amend",
      rationale: "Need to update",
      evidence_refs: [],
      created_by: "system",
    });
    assert.ok(result.error?.includes("requires evidence references"));
  });

  await test("valid change proposal created", () => {
    const result = api.proposeConstitutionalChange({
      target_type: "principle",
      target_id: "p1",
      change_type: "amend",
      rationale: "Need to update based on new evidence",
      evidence_refs: ["evidence_1", "evidence_2"],
      created_by: "system",
    });
    assert.ok(result.proposal.change_id);
    assert.equal(result.proposal.status, "pending_review");
  });

  console.log("\nIntegration: Supersession Preserves History:");

  await test("superseded doctrine preserves lineage", () => {
    const principle = api.createConstitutionalPrinciple({
      title: "No opaque optimization",
      description: "All optimization must be explainable",
      category: "adaptation",
      precedence_level: 90,
      created_by: "system",
    });
    const doctrine = api.registerDoctrineRecord({
      title: "Optimization transparency rule",
      doctrine_type: "invariant",
      linked_principle_ids: [principle.principle_id],
      linked_artifacts: [],
      created_by: "system",
    });
    const change = api.proposeConstitutionalChange({
      target_type: "doctrine",
      target_id: doctrine.doctrine.doctrine_id,
      change_type: "supersede",
      rationale: "Updated based on R7 evidence",
      evidence_refs: ["evidence_1"],
      created_by: "system",
    });
    api.approveConstitutionalChange(change.proposal.change_id, "reviewer_1");
    api.applyConstitutionalChange(change.proposal.change_id, "system");

    const updated = repos.doctrines.getById(doctrine.doctrine.doctrine_id);
    assert.ok(updated);
    assert.equal(updated!.status, "superseded");

    const audit = api.getConstitutionalAuditTrail("change", change.proposal.change_id);
    assert.ok(audit.some((e) => e.event_type === "constitutional_change_proposed"));
    assert.ok(audit.some((e) => e.event_type === "constitutional_change_approved"));
    assert.ok(audit.some((e) => e.event_type === "constitutional_change_applied"));
  });

  console.log("\nIntegration: Rollback Restores Constitutional State:");

  await test("rollback restores previous principle state", () => {
    const principle = api.createConstitutionalPrinciple({
      title: "Crisis mode preserves governance",
      description: "Crisis mode cannot disable governance",
      category: "continuity",
      precedence_level: 95,
      created_by: "system",
    });
    const change = api.proposeConstitutionalChange({
      target_type: "principle",
      target_id: principle.principle_id,
      change_type: "revoke",
      rationale: "Emergency override needed",
      evidence_refs: ["emergency_evidence"],
      created_by: "crisis_owner",
    });
    api.approveConstitutionalChange(change.proposal.change_id, "safety_admin");
    api.applyConstitutionalChange(change.proposal.change_id, "system");

    const revoked = repos.principles.getById(principle.principle_id);
    assert.equal(revoked!.status, "revoked");

    const rollbackResult = api.rollbackConstitutionalChange(change.proposal.change_id, "safety_admin", "Emergency resolved");
    assert.equal(rollbackResult.rolled_back, true);

    const restored = repos.principles.getById(principle.principle_id);
    assert.equal(restored!.status, "active");
  });

  console.log("\nIntegration: Memory Record Must Be Governance-Relevant:");

  await test("institutional memory without principle or doctrine rejected", () => {
    const result = api.recordInstitutionalMemory({
      memory_type: "crisis_lesson",
      title: "Unlinked memory",
      summary: "Some lesson learned",
      linked_principle_ids: [],
      linked_doctrine_ids: [],
      source_refs: ["source_1"],
      created_by: "system",
    });
    assert.ok(result.error?.includes("requires at least one linked principle or doctrine"));
  });

  await test("institutional memory with principle link accepted", () => {
    const principle = api.createConstitutionalPrinciple({
      title: "External trust requires explicit contract",
      description: "No external trust without contract",
      category: "trust",
      precedence_level: 85,
      created_by: "system",
    });
    const result = api.recordInstitutionalMemory({
      memory_type: "compliance_lesson",
      title: "External contract revocation lesson",
      summary: "Always require re-verification after crisis",
      linked_principle_ids: [principle.principle_id],
      linked_doctrine_ids: [],
      source_refs: ["crisis_1"],
      created_by: "compliance_admin",
    });
    assert.ok(result.memory.memory_id);
    assert.equal(result.memory.linked_principle_ids.length, 1);
  });

  console.log("\nIntegration: Hidden Doctrine Mutation Blocked:");

  await test("doctrine cannot be silently changed without constitutional flow", () => {
    const principle = api.createConstitutionalPrinciple({
      title: "No hidden authority escalation",
      description: "Authority changes must be explicit",
      category: "governance",
      precedence_level: 98,
      created_by: "system",
    });
    const doctrine = api.registerDoctrineRecord({
      title: "Authority escalation rule",
      doctrine_type: "governance_rule",
      linked_principle_ids: [principle.principle_id],
      linked_artifacts: [],
      created_by: "system",
    });

    // Direct save through repos is possible, but audit trail captures it
    // The key is that the API requires constitutional change flow
    const changeResult = api.proposeConstitutionalChange({
      target_type: "doctrine",
      target_id: doctrine.doctrine.doctrine_id,
      change_type: "amend",
      rationale: "Update authority escalation thresholds",
      evidence_refs: ["evidence_1"],
      created_by: "system",
    });
    assert.equal(changeResult.proposal.status, "pending_review");

    // Cannot apply without approval
    const applyResult = api.applyConstitutionalChange(changeResult.proposal.change_id, "system");
    assert.equal(applyResult.applied, false);
    assert.ok(applyResult.error?.includes("not approved"));
  });

  console.log("\nIntegration: Audit Trail Explainable:");

  await test("constitutional audit trail contains full decision chain", () => {
    const principle = api.createConstitutionalPrinciple({
      title: "Simulation before activation",
      description: "All activation must be simulated first",
      category: "safety",
      precedence_level: 88,
      created_by: "system",
    });
    const doctrine = api.registerDoctrineRecord({
      title: "Simulation requirement",
      doctrine_type: "invariant",
      linked_principle_ids: [principle.principle_id],
      linked_artifacts: [],
      created_by: "system",
    });
    const change = api.proposeConstitutionalChange({
      target_type: "doctrine",
      target_id: doctrine.doctrine.doctrine_id,
      change_type: "amend",
      rationale: "Update simulation requirements",
      evidence_refs: ["evidence_1"],
      created_by: "system",
    });
    api.approveConstitutionalChange(change.proposal.change_id, "reviewer_1");
    api.applyConstitutionalChange(change.proposal.change_id, "system");
    api.rollbackConstitutionalChange(change.proposal.change_id, "reviewer_1", "Regression detected");

    const audit = api.getConstitutionalAuditTrail();
    const eventTypes = audit.map((e) => e.event_type);
    assert.ok(eventTypes.includes("principle_created"));
    assert.ok(eventTypes.includes("doctrine_registered"));
    assert.ok(eventTypes.includes("constitutional_change_proposed"));
    assert.ok(eventTypes.includes("constitutional_change_approved"));
    assert.ok(eventTypes.includes("constitutional_change_applied"));
    assert.ok(eventTypes.includes("constitutional_change_rolled_back"));
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
