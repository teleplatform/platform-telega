import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createCandidatesRepo, createTrialsRepo, createMetricsRepo, createEvaluationsRepo, createRolloutsRepo, createRollbacksRepo } from "../../packages/runtime-optimization-core/src/storage/sqlite/optimizationRepo.js";
import { createOptimizationApi } from "../../packages/runtime-optimization-core/src/api/optimizationApi.js";

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
  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "../../packages/runtime-optimization-core/src/storage/sqlite/schema.sql");
  db.exec(readFileSync(schemaPath, "utf-8"));

  const candidatesRepo = createCandidatesRepo(db);
  const trialsRepo = createTrialsRepo(db);
  const metricsRepo = createMetricsRepo(db);
  const evaluationsRepo = createEvaluationsRepo(db);
  const rolloutsRepo = createRolloutsRepo(db);
  const rollbacksRepo = createRollbacksRepo(db);

  const api = createOptimizationApi({
    candidatesRepo,
    trialsRepo,
    metricsRepo,
    evaluationsRepo,
    rolloutsRepo,
    rollbacksRepo,
  });

  console.log("\nIntegration: Trial Requires Scope:");

  await test("trial with valid scope percentage created", () => {
    const candidate = api.createOptimizationCandidate({
      proposal_id: "prop_1",
      intent_type: "route_optimization",
      target_type: "route",
      target_id: "route_1",
      proposed_params: { priority: 2 },
      created_by: "system",
    });
    const { trial, baseline } = api.startOptimizationTrial({ candidate_id: candidate.candidate_id, scope_percentage: 10, duration_ms: 60000 });
    assert.ok(trial.trial_id);
    assert.equal(trial.scope.percentage, 10);
    assert.equal(trial.status, "running");
  });

  await test("trial with zero scope rejected", () => {
    const candidate = api.createOptimizationCandidate({
      proposal_id: "prop_2",
      intent_type: "retry_optimization",
      target_type: "route",
      target_id: "route_2",
      proposed_params: { retries: 1 },
      created_by: "system",
    });
    assert.throws(() => api.startOptimizationTrial({ candidate_id: candidate.candidate_id, scope_percentage: 0, duration_ms: 60000 }));
  });

  console.log("\nIntegration: Metrics Recorded:");

  await test("baseline and candidate metrics written", () => {
    const candidate = api.createOptimizationCandidate({
      proposal_id: "prop_3",
      intent_type: "fallback_optimization",
      target_type: "route",
      target_id: "route_3",
      proposed_params: { fallback_threshold: 0.5 },
      created_by: "system",
    });
    const { trial, baseline } = api.startOptimizationTrial({ candidate_id: candidate.candidate_id, scope_percentage: 5, duration_ms: 60000 });
    const candidateMetrics = { success_rate: 0.85, failure_rate: 0.15, recovery_success_rate: 0.8, fallback_frequency: 0.2, retry_count: 1.5, latency: 900, timeout_rate: 0.03, manual_takeover_rate: 0.08 };
    const metrics = api.recordOptimizationMetrics({ trial_id: trial.trial_id, baseline, candidate: candidateMetrics });
    assert.ok(metrics.metric_id);
    assert.equal(metrics.baseline.success_rate, 0.8);
    assert.equal(metrics.candidate.success_rate, 0.85);
  });

  console.log("\nIntegration: Evaluation Detects Improvement:");

  await test("improvement detected → accept", () => {
    const candidate = api.createOptimizationCandidate({
      proposal_id: "prop_4",
      intent_type: "route_optimization",
      target_type: "route",
      target_id: "route_4",
      proposed_params: { priority: 3 },
      created_by: "system",
    });
    const { trial, baseline } = api.startOptimizationTrial({ candidate_id: candidate.candidate_id, scope_percentage: 10, duration_ms: 60000 });
    const candidateMetrics = { success_rate: 0.92, failure_rate: 0.08, recovery_success_rate: 0.85, fallback_frequency: 0.15, retry_count: 1, latency: 800, timeout_rate: 0.02, manual_takeover_rate: 0.05 };
    api.recordOptimizationMetrics({ trial_id: trial.trial_id, baseline, candidate: candidateMetrics });
    const evaluation = api.evaluateOptimizationTrial({ candidate_id: candidate.candidate_id, trial_id: trial.trial_id, metrics: { baseline, candidate: candidateMetrics } });
    assert.equal(evaluation.improvement, true);
    assert.equal(evaluation.regression, false);
    assert.equal(evaluation.decision, "accept");
  });

  console.log("\nIntegration: Evaluation Detects Regression:");

  await test("regression detected → reject", () => {
    const candidate = api.createOptimizationCandidate({
      proposal_id: "prop_5",
      intent_type: "retry_optimization",
      target_type: "route",
      target_id: "route_5",
      proposed_params: { retries: 0 },
      created_by: "system",
    });
    const { trial, baseline } = api.startOptimizationTrial({ candidate_id: candidate.candidate_id, scope_percentage: 10, duration_ms: 60000 });
    const candidateMetrics = { success_rate: 0.6, failure_rate: 0.4, recovery_success_rate: 0.5, fallback_frequency: 0.5, retry_count: 3, latency: 1500, timeout_rate: 0.15, manual_takeover_rate: 0.2 };
    api.recordOptimizationMetrics({ trial_id: trial.trial_id, baseline, candidate: candidateMetrics });
    const evaluation = api.evaluateOptimizationTrial({ candidate_id: candidate.candidate_id, trial_id: trial.trial_id, metrics: { baseline, candidate: candidateMetrics } });
    assert.equal(evaluation.regression, true);
    assert.equal(evaluation.decision, "reject");
  });

  console.log("\nIntegration: Accepted Rollout Staged:");

  await test("accepted candidate rolls out in stages", () => {
    const candidate = api.createOptimizationCandidate({
      proposal_id: "prop_6",
      intent_type: "route_optimization",
      target_type: "route",
      target_id: "route_6",
      proposed_params: { priority: 4 },
      created_by: "system",
    });
    const { trial, baseline } = api.startOptimizationTrial({ candidate_id: candidate.candidate_id, scope_percentage: 10, duration_ms: 60000 });
    const candidateMetrics = { success_rate: 0.95, failure_rate: 0.05, recovery_success_rate: 0.9, fallback_frequency: 0.1, retry_count: 1, latency: 700, timeout_rate: 0.01, manual_takeover_rate: 0.03 };
    api.recordOptimizationMetrics({ trial_id: trial.trial_id, baseline, candidate: candidateMetrics });
    api.evaluateOptimizationTrial({ candidate_id: candidate.candidate_id, trial_id: trial.trial_id, metrics: { baseline, candidate: candidateMetrics } });
    api.acceptOptimizationCandidate(candidate.candidate_id);
    const { rollout } = api.rolloutAcceptedOptimization({ candidate_id: candidate.candidate_id, stage: "partial" });
    assert.ok(rollout.rollout_id);
    assert.equal(rollout.stage, "partial");
    assert.equal(rollout.status, "running");
  });

  console.log("\nIntegration: Rollback on Regression:");

  await test("rollback restores previous state with record", () => {
    const candidate = api.createOptimizationCandidate({
      proposal_id: "prop_7",
      intent_type: "fallback_optimization",
      target_type: "route",
      target_id: "route_7",
      proposed_params: { fallback_threshold: 0.3 },
      created_by: "system",
    });
    const { trial, baseline } = api.startOptimizationTrial({ candidate_id: candidate.candidate_id, scope_percentage: 10, duration_ms: 60000 });
    const candidateMetrics = { success_rate: 0.9, failure_rate: 0.1, recovery_success_rate: 0.85, fallback_frequency: 0.15, retry_count: 1, latency: 800, timeout_rate: 0.02, manual_takeover_rate: 0.05 };
    api.recordOptimizationMetrics({ trial_id: trial.trial_id, baseline, candidate: candidateMetrics });
    api.evaluateOptimizationTrial({ candidate_id: candidate.candidate_id, trial_id: trial.trial_id, metrics: { baseline, candidate: candidateMetrics } });
    api.acceptOptimizationCandidate(candidate.candidate_id);
    const { rollout } = api.rolloutAcceptedOptimization({ candidate_id: candidate.candidate_id, stage: "partial" });
    const { rollback } = api.rollbackOptimizationRollout({ rollout_id: rollout.rollout_id, candidate_id: candidate.candidate_id, reason: "Regression detected in expanded scope" });
    assert.ok(rollback.rollback_id);
    assert.equal(rollback.reason, "Regression detected in expanded scope");
  });

  console.log("\nIntegration: Candidate Without Proposal Blocked:");

  await test("candidate without R6 proposal_id rejected", () => {
    assert.throws(() => api.createOptimizationCandidate({
      proposal_id: "",
      intent_type: "route_optimization",
      target_type: "route",
      target_id: "route_8",
      proposed_params: { priority: 5 },
      created_by: "system",
    }), /requires R6 proposal_id/);
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
