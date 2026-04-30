import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createProposalsRepo, createEvidenceRepo, createReviewsRepo, createChangesRepo, createRollbacksRepo } from "../../packages/runtime-adaptation-core/src/storage/sqlite/adaptationRepo.js";
import { createAdaptationApi } from "../../packages/runtime-adaptation-core/src/api/adaptationApi.js";

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
  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "../../packages/runtime-adaptation-core/src/storage/sqlite/schema.sql");
  db.exec(readFileSync(schemaPath, "utf-8"));

  const proposalsRepo = createProposalsRepo(db);
  const evidenceRepo = createEvidenceRepo(db);
  const reviewsRepo = createReviewsRepo(db);
  const changesRepo = createChangesRepo(db);
  const rollbacksRepo = createRollbacksRepo(db);

  const api = createAdaptationApi({
    proposalsRepo,
    evidenceRepo,
    reviewsRepo,
    changesRepo,
    rollbacksRepo,
  });

  console.log("\nIntegration: Proposal Requires Evidence:");

  await test("proposal without evidence refs is rejected", () => {
    assert.throws(() => api.createAdaptationProposal({
      proposal_type: "route_priority_adjustment",
      target_type: "route",
      target_id: "route_no_evidence",
      title: "Adjust route priority without evidence",
      rationale: "No evidence provided",
      evidence_refs: [],
      risk_class: "medium",
      proposed_change: { priority: 2 },
      created_by: "system",
    }), /requires at least one evidence reference/);
  });

  await test("proposal with evidence refs created successfully", () => {
    const result = api.createAdaptationProposal({
      proposal_type: "route_priority_adjustment",
      target_type: "route",
      target_id: "route_1",
      title: "Adjust route priority",
      rationale: "Route 1 has high failure rate",
      evidence_refs: ["fb_event_1", "fb_event_2"],
      risk_class: "medium",
      proposed_change: { priority: 2 },
      created_by: "system",
    });
    assert.ok(result.proposal.proposal_id);
    assert.equal(result.proposal.evidence_refs.length, 2);
    assert.equal(result.policy.outcome, "review_required");
  });

  await test("low risk proposal auto-applies", () => {
    const result = api.createAdaptationProposal({
      proposal_type: "reliability_score_update",
      target_type: "transport",
      target_id: "transport_1",
      title: "Update reliability score",
      rationale: "Transport has been stable",
      evidence_refs: ["summary_1"],
      risk_class: "low",
      proposed_change: { score: 0.95 },
      created_by: "system",
    });
    assert.equal(result.proposal.status, "approved");
    assert.equal(result.policy.outcome, "auto_apply_allowed");
  });

  await test("forbidden proposal blocked by policy", () => {
    const result = api.createAdaptationProposal({
      proposal_type: "manual_takeover_threshold",
      target_type: "tool",
      target_id: "tool_1",
      title: "Disable safety check",
      rationale: "Remove safety check",
      evidence_refs: ["evidence_1"],
      risk_class: "forbidden",
      proposed_change: { safety_check: false },
      created_by: "system",
    });
    assert.equal(result.policy.outcome, "forbidden");
    assert.equal(result.proposal.status, "pending_review");
  });

  console.log("\nIntegration: Forbidden Change Blocked:");

  await test("forbidden proposal cannot be approved", () => {
    const result = api.createAdaptationProposal({
      proposal_type: "verification_step_addition",
      target_type: "verification_rule",
      target_id: "rule_1",
      title: "Remove verification",
      rationale: "Remove verification step",
      evidence_refs: ["evidence_2"],
      risk_class: "forbidden",
      proposed_change: { verification: false },
      created_by: "system",
    });
    const approveResult = api.approveProposal(result.proposal.proposal_id, "reviewer_1", "Approved");
    assert.equal(approveResult.approved, false);
    assert.ok(approveResult.error?.includes("Forbidden") || approveResult.error?.includes("status"));
  });

  console.log("\nIntegration: High Risk Review Required:");

  await test("high risk proposal requires review", () => {
    const result = api.createAdaptationProposal({
      proposal_type: "transport_preference_adjustment",
      target_type: "transport",
      target_id: "telegram",
      title: "Lower telegram priority",
      rationale: "Telegram has high degradation rate",
      evidence_refs: ["route_summary_1", "transport_degradation_1"],
      risk_class: "high",
      proposed_change: { priority: 1 },
      created_by: "system",
    });
    assert.equal(result.policy.outcome, "review_required");
    assert.equal(result.proposal.status, "pending_review");
  });

  await test("high risk proposal cannot auto-apply", () => {
    const result = api.createAdaptationProposal({
      proposal_type: "fallback_preference_adjustment",
      target_type: "recovery_rule",
      target_id: "rule_1",
      title: "Change fallback preference",
      rationale: "Web fallback more reliable",
      evidence_refs: ["recovery_summary_1"],
      risk_class: "high",
      proposed_change: { preferred_fallback: "web" },
      created_by: "system",
    });
    const applyResult = api.applyApprovedChange(result.proposal.proposal_id, "system");
    assert.equal(applyResult.applied, false);
    assert.ok(applyResult.error?.includes("not approved"));
  });

  console.log("\nIntegration: Approved Change Applies with Audit:");

  await test("approved proposal applies with audit trail", () => {
    const result = api.createAdaptationProposal({
      proposal_type: "route_priority_adjustment",
      target_type: "route",
      target_id: "route_2",
      title: "Adjust route 2 priority",
      rationale: "Route 2 performance degraded",
      evidence_refs: ["route_summary_2"],
      risk_class: "low",
      proposed_change: { priority: 3 },
      created_by: "system",
    });
    assert.equal(result.proposal.status, "approved");

    const applyResult = api.applyApprovedChange(result.proposal.proposal_id, "system");
    assert.equal(applyResult.applied, true);
    assert.ok(applyResult.change?.change_id);

    const audit = api.getProposalAuditTrail(result.proposal.proposal_id);
    assert.ok(audit.events.length >= 2);
    assert.ok(audit.events.some((e) => e.event_type === "proposal_created"));
    assert.ok(audit.events.some((e) => e.event_type === "change_applied"));
  });

  await test("rejected proposal does not change runtime", () => {
    const result = api.createAdaptationProposal({
      proposal_type: "tool_chain_stability_flag",
      target_type: "tool",
      target_id: "tool_2",
      title: "Flag tool as unstable",
      rationale: "Tool has high failure rate",
      evidence_refs: ["tool_failure_1"],
      risk_class: "medium",
      proposed_change: { stable: false },
      created_by: "system",
    });
    const rejectResult = api.rejectProposal(result.proposal.proposal_id, "reviewer_1", "Not enough evidence");
    assert.equal(rejectResult.rejected, true);

    const applyResult = api.applyApprovedChange(result.proposal.proposal_id, "system");
    assert.equal(applyResult.applied, false);
  });

  console.log("\nIntegration: Rollback Restores State:");

  await test("rollback restores previous state with record", () => {
    const result = api.createAdaptationProposal({
      proposal_type: "recovery_rule_refinement",
      target_type: "recovery_rule",
      target_id: "rule_2",
      title: "Update recovery rule",
      rationale: "Recovery rule needs adjustment",
      evidence_refs: ["recovery_summary_2"],
      risk_class: "low",
      proposed_change: { timeout_ms: 5000 },
      created_by: "system",
    });
    api.applyApprovedChange(result.proposal.proposal_id, "system");

    const rollbackResult = api.rollbackAppliedChange(result.proposal.proposal_id, "system", "Change caused issues");
    assert.equal(rollbackResult.rolled_back, true);
    assert.ok(rollbackResult.rollback?.rollback_id);

    const audit = api.getProposalAuditTrail(result.proposal.proposal_id);
    assert.ok(audit.events.some((e) => e.event_type === "change_rolled_back"));
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
