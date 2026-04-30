/**
 * Tests for V8.8–V9.3: Collective Intelligence → Governed Core Evolution
 *
 * V8.8 — VoiceKnowledgeFederation (cross-mission federation)
 * V8.9 — VoiceCollectiveTemplateRanking (template classification)
 * V9.0 — VoiceCollectiveGovernor (global knowledge authority)
 * V9.1 — VoiceCoreKnowledgePromotion (constitutional admission)
 * V9.2 — VoiceCorePatternDeployment (staged deployment)
 * V9.3 — VoiceCoreIntegritySentinel (integrity watch)
 *
 * Integration: voiceGovernedCoreEvolution.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ============================================================================
// V9.1 — Constitutional Admission
// ============================================================================

import {
  decideCorePromotion,
  validatePromotionDecision,
  clearPromotionRegistry,
  getAdmittedPromotions,
  getRejectedPromotions,
} from "../../../src/telegram/voiceCoreKnowledgePromotion.js";

function makeMockScore(overrides: Record<string, any> = {}) {
  return {
    scoreId: "score_test_1",
    templateId: overrides.templateId ?? "tpl_test_1",
    dimensions: {
      stabilityScore: overrides.stabilityScore ?? 80,
      transferabilityScore: overrides.transferabilityScore ?? 85,
      riskScore: overrides.riskScore ?? 20,
      reuseScore: overrides.reuseScore ?? 75,
    },
    overallRank: overrides.overallRank ?? 85,
    classification: overrides.classification ?? "high_value_core",
    recommendedUsage: overrides.recommendedUsage ?? "prefer",
    evaluatedAt: Date.now(),
    evaluationSummary: "mock score",
  };
}

describe("V9.1 — Constitutional Admission", () => {
  it("admits high-value core template with strong scores", () => {
    const score = makeMockScore({
      stabilityScore: 85,
      transferabilityScore: 90,
      riskScore: 15,
      overallRank: 88,
      classification: "high_value_core",
    });

    const result = decideCorePromotion({
      templateId: "tpl_hvc_1",
      score,
      touchesSensitiveCore: false,
    });

    assert.equal(result.promotionStatus, "admitted");
    assert.equal(result.promotionScope, "core_global");
    assert.equal(
      result.constitutionalChecks.every((c) => c.passed),
      true,
    );
  });

  it("rejects template with high risk score", () => {
    const score = makeMockScore({
      riskScore: 95,
      overallRank: 90,
      transferabilityScore: 90,
    });

    const result = decideCorePromotion({
      templateId: "tpl_risky_1",
      score,
      touchesSensitiveCore: false,
    });

    assert.equal(result.promotionStatus, "rejected");
    assert.equal(
      result.constitutionalChecks.some((c) => !c.passed),
      true,
    );
  });

  it("forces creator_only for sensitive core templates", () => {
    const score = makeMockScore({
      riskScore: 10,
      overallRank: 90,
    });

    const result = decideCorePromotion({
      templateId: "tpl_sensitive_1",
      score,
      touchesSensitiveCore: true,
    });

    assert.equal(result.promotionStatus, "creator_only");
    assert.equal(result.requiredReviewMode, "creator_only");
  });

  it("defers template with low overall rank", () => {
    const score = makeMockScore({
      overallRank: 40,
      transferabilityScore: 30,
      classification: "local_only",
    });

    const result = decideCorePromotion({
      templateId: "tpl_weak_1",
      score,
      touchesSensitiveCore: false,
    });

    assert.equal(
      result.promotionStatus === "deferred" || result.promotionStatus === "rejected",
      true,
      "Low-rank template should be deferred or rejected",
    );
  });

  it("validates constitutional checks completeness", () => {
    const score = makeMockScore();
    const result = decideCorePromotion({
      templateId: "tpl_valid_1",
      score,
      touchesSensitiveCore: false,
    });

    const errors = validatePromotionDecision(result);
    assert.equal(errors.length, 0, "Valid decision should have no errors");
  });
});

// ============================================================================
// V9.2 — Governed Core Deployment
// ============================================================================

import {
  planCoreDeployment,
  startDeployment,
  validateDeployment,
  rollbackDeployment,
  failDeployment,
  promoteToCoreActive,
  clearDeploymentRegistry,
  getRunningDeployments,
  getValidatedDeployments,
} from "../../../src/telegram/voiceCorePatternDeployment.js";

describe("V9.2 — Governed Core Deployment", () => {
  it("plans deployment with staged mode for core_global scope", () => {
    const deployment = planCoreDeployment({
      templateId: "tpl_1",
      promotionDecisionId: "promo_1",
      promotionScope: "core_global",
      targets: [{ targetType: "mission_planning", targetId: "mp_1" }],
    });

    assert.equal(deployment.deploymentMode, "staged");
    assert.equal(deployment.deploymentStatus, "prepared");
    assert.ok(deployment.validationWindowMs > 0);
  });

  it("starts deployment from prepared to running", () => {
    const deployment = planCoreDeployment({
      templateId: "tpl_2",
      promotionDecisionId: "promo_2",
      promotionScope: "multi_domain",
      targets: [{ targetType: "adaptation_gate", targetId: "ag_1" }],
    });

    const started = startDeployment(deployment);
    assert.equal(started.deploymentStatus, "running");
    assert.ok(started.startedAt);
  });

  it("blocks direct core_active deployment", () => {
    const deployment = planCoreDeployment({
      templateId: "tpl_3",
      promotionDecisionId: "promo_3",
      promotionScope: "core_global",
      targets: [{ targetType: "mission_planning", targetId: "mp_1" }],
    });

    const invalid = { ...deployment, deploymentMode: "core_active" as const };

    assert.throws(
      () => startDeployment(invalid),
      /NO CORE PATTERN DEPLOYMENT MAY START DIRECTLY IN FULL ACTIVE MODE/,
    );
  });

  it("validates deployment rejects empty targets", () => {
    const deployment = planCoreDeployment({
      templateId: "tpl_4",
      promotionDecisionId: "promo_4",
      promotionScope: "local_domain",
      targets: [],
    });

    const errors = validateDeployment(deployment);
    assert.ok(
      errors.includes("no_deployment_targets"),
      "Should reject empty targets",
    );
  });

  it("rolls back deployment with reason", () => {
    const deployment = planCoreDeployment({
      templateId: "tpl_5",
      promotionDecisionId: "promo_5",
      promotionScope: "core_global",
      targets: [{ targetType: "mission_planning", targetId: "mp_1" }],
    });

    const started = startDeployment(deployment);
    const rolledBack = rollbackDeployment(started, "integrity failure");

    assert.equal(rolledBack.deploymentStatus, "rolled_back");
    assert.equal(rolledBack.failedReason, "integrity failure");
    assert.ok(rolledBack.rolledBackAt);
  });

  it("promotes validated deployment to core_active", () => {
    const deployment = planCoreDeployment({
      templateId: "tpl_6",
      promotionDecisionId: "promo_6",
      promotionScope: "core_global",
      targets: [{ targetType: "mission_planning", targetId: "mp_1" }],
    });

    const started = startDeployment(deployment);
    const validated = {
      ...started,
      deploymentStatus: "validated" as const,
      validatedAt: Date.now(),
    };

    const promoted = promoteToCoreActive(validated);
    assert.equal(promoted.deploymentMode, "core_active");
    assert.equal(promoted.deploymentStatus, "running");
  });
});

// ============================================================================
// V9.3 — Core Integrity Sentinel
// ============================================================================

import {
  evaluateCoreIntegrity,
  enforceRollbackForCriticalFailure,
  hasCriticalSignals,
  isDegradingTrend,
  clearIntegrityWatchRegistry,
  getCriticalWatches,
  getWatchesRequiringAction,
  type VoiceIntegritySignal,
} from "../../../src/telegram/voiceCoreIntegritySentinel.js";

describe("V9.3 — Core Integrity Sentinel", () => {
  it("evaluates healthy deployment with no signals", () => {
    const watch = evaluateCoreIntegrity({
      deploymentId: "dep_1",
      templateId: "tpl_1",
      integritySignals: [],
    });

    assert.equal(watch.watchStatus, "healthy");
    assert.equal(watch.integrityScore, 100);
    assert.equal(watch.recommendedAction, "keep");
  });

  it("detects critical integrity failure and forces rollback", () => {
    const signals: VoiceIntegritySignal[] = [
      { type: "consistency_violation", severity: 92 },
      { type: "regression_detected", severity: 88 },
    ];

    const watch = evaluateCoreIntegrity({
      deploymentId: "dep_2",
      templateId: "tpl_2",
      integritySignals: signals,
    });

    assert.equal(watch.watchStatus, "critical");
    assert.equal(watch.recommendedAction, "rollback_from_core");

    const rollbackCheck = enforceRollbackForCriticalFailure(watch);
    assert.equal(rollbackCheck.shouldRollback, true);
  });

  it("detects degrading trend from score delta", () => {
    const watch = evaluateCoreIntegrity({
      deploymentId: "dep_3",
      templateId: "tpl_3",
      integritySignals: [{ type: "context_mismatch", severity: 50 }],
      previousScore: 90,
    });

    assert.ok(watch.scoreDelta !== undefined);
    assert.ok(watch.scoreDelta! < 0, "Score should be degrading");
  });

  it("identifies critical signals correctly", () => {
    const watch = evaluateCoreIntegrity({
      deploymentId: "dep_4",
      templateId: "tpl_4",
      integritySignals: [{ type: "goal_misalignment", severity: 90 }],
    });

    assert.equal(hasCriticalSignals(watch), true);
  });

  it("restricts scope for moderate severity signals", () => {
    const watch = evaluateCoreIntegrity({
      deploymentId: "dep_5",
      templateId: "tpl_5",
      integritySignals: [{ type: "overgeneralization", severity: 45 }],
    });

    assert.equal(watch.watchStatus, "watching");
    assert.equal(watch.recommendedAction, "restrict_scope");
  });

  it("revalidates for high severity signals", () => {
    const watch = evaluateCoreIntegrity({
      deploymentId: "dep_6",
      templateId: "tpl_6",
      integritySignals: [{ type: "consistency_violation", severity: 70 }],
    });

    assert.equal(watch.watchStatus, "degrading");
    assert.equal(watch.recommendedAction, "revalidate");
  });
});

// ============================================================================
// Integration: V9.1–V9.3 Governed Core Evolution
// ============================================================================

import {
  runGovernedCoreEvolution,
  type VoiceGovernedCoreEvolutionInput,
} from "../../../src/telegram/voiceGovernedCoreEvolution.js";

describe("Integration: V9.1–V9.3 Governed Core Evolution", () => {
  it("runs full pipeline for admitted template", () => {
    const score = makeMockScore({
      stabilityScore: 88,
      transferabilityScore: 90,
      riskScore: 15,
      overallRank: 88,
      classification: "high_value_core",
    });

    const input: VoiceGovernedCoreEvolutionInput = {
      templateId: "tpl_integration_1",
      score,
      touchesSensitiveCore: false,
      targets: [{ targetType: "mission_planning", targetId: "mp_1" }],
    };

    const result = runGovernedCoreEvolution(input);

    assert.equal(result.pipelineStatus, "admitted_and_deployed");
    assert.equal(result.promotion.promotionStatus, "admitted");
    assert.ok(result.deployment, "Deployment should exist");
    assert.ok(result.integrityWatch, "Integrity watch should exist");
    assert.equal(result.deployment?.deploymentStatus, "running");
  });

  it("stops pipeline for rejected template", () => {
    const score = makeMockScore({
      riskScore: 95,
      overallRank: 30,
      classification: "local_only",
    });

    const input: VoiceGovernedCoreEvolutionInput = {
      templateId: "tpl_reject_1",
      score,
      touchesSensitiveCore: false,
      targets: [{ targetType: "mission_planning", targetId: "mp_1" }],
    };

    const result = runGovernedCoreEvolution(input);

    assert.equal(
      result.pipelineStatus === "rejected" ||
        result.pipelineStatus === "deferred",
      true,
      "Pipeline should stop for rejected/deferred template",
    );
    assert.ok(!result.deployment, "Deployment should not exist");
  });

  it("enforces rollback in pipeline with critical signals", () => {
    const score = makeMockScore({
      stabilityScore: 85,
      transferabilityScore: 80,
      riskScore: 25,
      overallRank: 82,
      classification: "high_value_core",
    });

    const input: VoiceGovernedCoreEvolutionInput = {
      templateId: "tpl_rollback_1",
      score,
      touchesSensitiveCore: false,
      targets: [{ targetType: "mission_planning", targetId: "mp_1" }],
      integritySignals: [
        { type: "consistency_violation", severity: 95 },
      ],
    };

    const result = runGovernedCoreEvolution(input);

    assert.equal(result.pipelineStatus, "admitted_and_deployed");
    assert.ok(result.integrityWatch);
    assert.equal(result.integrityWatch.watchStatus, "critical");
    assert.equal(
      result.integrityWatch.recommendedAction,
      "rollback_from_core",
    );
  });
});
