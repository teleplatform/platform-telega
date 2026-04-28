/**
 * Voice Governed Core Evolution — Integration Orchestrator v9.3
 *
 * Wires together V9.1–V9.3:
 *
 *   collective intelligence → constitutional promotion → staged deployment
 *   → integrity sentinel
 *
 * Layers:
 *   V9.1 — VoiceCoreKnowledgePromotion (constitutional admission)
 *   V9.2 — VoiceCorePatternDeployment (staged deployment)
 *   V9.3 — VoiceCoreIntegritySentinel (integrity watch)
 *
 * Full pipeline:
 *   mission knowledge → federation (V8.8) → ranking (V8.9) → governor (V9.0)
 *   → constitutional promotion (V9.1) → staged deployment (V9.2)
 *   → integrity sentinel (V9.3)
 */

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type {
  VoiceCoreKnowledgePromotionDecision,
  VoicePromotionStatus,
  VoicePromotionScope,
  VoiceRequiredReviewMode,
  VoiceConstitutionalCheckResult,
  VoiceConstitutionalCheck,
} from "./voiceCoreKnowledgePromotion.js";

export type {
  VoiceCorePatternDeployment,
  VoiceDeploymentMode,
  VoiceDeploymentStatus,
  VoiceDeploymentTarget,
  VoiceDeploymentTargetType,
} from "./voiceCorePatternDeployment.js";

export type {
  VoiceCoreKnowledgeIntegrityWatch,
  VoiceIntegritySignalType,
  VoiceIntegrityWatchStatus,
  VoiceIntegrityAction,
  VoiceIntegritySignal,
} from "./voiceCoreIntegritySentinel.js";

// ============================================================================
// Core imports
// ============================================================================

import {
  decideCorePromotion,
  registerPromotionDecision,
  getAdmittedPromotions,
  type VoiceCoreKnowledgePromotionDecision,
  type VoiceCorePromotionInput,
} from "./voiceCoreKnowledgePromotion.js";

import {
  planCoreDeployment,
  startDeployment,
  validateDeployment,
  rollbackDeployment,
  registerDeployment,
  getDeployment,
  type VoiceCorePatternDeployment,
  type VoiceDeploymentTarget,
} from "./voiceCorePatternDeployment.js";

import {
  evaluateCoreIntegrity,
  enforceRollbackForCriticalFailure,
  registerIntegrityWatch,
  getWatchesForDeployment,
  type VoiceCoreKnowledgeIntegrityWatch,
  type VoiceIntegritySignal,
} from "./voiceCoreIntegritySentinel.js";

import type { VoiceCollectiveTemplateScore } from "./voiceCollectiveTemplateRanking.js";
import type { VoiceCollectiveIntelligenceGovernor } from "./voiceCollectiveGovernor.js";

// ============================================================================
// Integration types
// ============================================================================

/**
 * Full governed core evolution result.
 */
export interface VoiceGovernedCoreEvolutionResult {
  // V9.1 — Constitutional Admission
  promotion: VoiceCoreKnowledgePromotionDecision;

  // V9.2 — Staged Deployment (only if admitted)
  deployment?: VoiceCorePatternDeployment;

  // V9.3 — Integrity Watch (only if deployment exists)
  integrityWatch?: VoiceCoreKnowledgeIntegrityWatch;

  // Overall status
  pipelineStatus: "admitted_and_deployed" | "admitted_pending" | "rejected" | "deferred" | "creator_only";
}

/**
 * Input for the full governed core evolution pipeline.
 */
export interface VoiceGovernedCoreEvolutionInput {
  templateId: string;
  federationId?: string;
  score: VoiceCollectiveTemplateScore;
  touchesSensitiveCore: boolean;
  targets: VoiceDeploymentTarget[];
  governor?: VoiceCollectiveIntelligenceGovernor;
  integritySignals?: VoiceIntegritySignal[];
}

// ============================================================================
// Integration pipeline
// ============================================================================

/**
 * Execute the full governed core evolution pipeline.
 *
 * Pipeline flow:
 *   1. Constitutional promotion decision (V9.1)
 *   2. If admitted → plan and start deployment (V9.2)
 *   3. If deployed → evaluate integrity (V9.3)
 */
export function runGovernedCoreEvolution(
  input: VoiceGovernedCoreEvolutionInput,
): VoiceGovernedCoreEvolutionResult {
  // ─── Step 1: Constitutional Promotion (V9.1) ───
  const promotionInput: VoiceCorePromotionInput = {
    templateId: input.templateId,
    federationId: input.federationId,
    score: input.score,
    touchesSensitiveCore: input.touchesSensitiveCore,
    governor: input.governor,
  };

  const promotion = decideCorePromotion(promotionInput);
  registerPromotionDecision(promotion);

  // If not admitted, stop pipeline
  if (promotion.promotionStatus !== "admitted") {
    return {
      promotion,
      pipelineStatus: promotion.promotionStatus === "deferred"
        ? "deferred"
        : promotion.promotionStatus === "creator_only"
          ? "creator_only"
          : "rejected",
    };
  }

  // ─── Step 2: Staged Deployment (V9.2) ───
  const deploymentPlan = planCoreDeployment({
    templateId: input.templateId,
    promotionDecisionId: promotion.decisionId,
    promotionScope: promotion.promotionScope,
    promotionStatus: promotion.promotionStatus,
    targets: input.targets,
  });

  // Validate before starting
  const validationErrors = validateDeployment(deploymentPlan);
  if (validationErrors.length > 0) {
    return {
      promotion,
      pipelineStatus: "rejected",
    };
  }

  const deployment = startDeployment(deploymentPlan);
  registerDeployment(deployment);

  // ─── Step 3: Integrity Evaluation (V9.3) ───
  const integrityWatch = evaluateCoreIntegrity({
    deploymentId: deployment.deploymentId,
    templateId: input.templateId,
    integritySignals: input.integritySignals ?? [],
  });

  registerIntegrityWatch(integrityWatch);

  return {
    promotion,
    deployment,
    integrityWatch,
    pipelineStatus: "admitted_and_deployed",
  };
}

// ============================================================================
// Post-deployment integrity check
// ============================================================================

/**
 * Check integrity of an existing deployment and enforce rollback if critical.
 */
export function checkDeploymentIntegrity(
  deploymentId: string,
  newSignals: VoiceIntegritySignal[],
): {
  watch: VoiceCoreKnowledgeIntegrityWatch;
  rollbackEnforced: boolean;
  rollbackReason?: string;
} {
  const deployment = getDeployment(deploymentId);
  if (!deployment) {
    throw new Error(`Deployment ${deploymentId} not found`);
  }

  // Evaluate integrity
  const watch = evaluateCoreIntegrity({
    deploymentId,
    templateId: deployment.templateId,
    integritySignals: newSignals,
  });

  registerIntegrityWatch(watch);

  // Check for rollback
  const rollbackCheck = enforceRollbackForCriticalFailure(watch);
  let rollbackEnforced = false;
  let rollbackReason: string | undefined;

  if (rollbackCheck.shouldRollback) {
    rollbackDeployment(deployment, rollbackCheck.reason);
    rollbackEnforced = true;
    rollbackReason = rollbackCheck.reason;
  }

  return {
    watch,
    rollbackEnforced,
    rollbackReason,
  };
}

// ============================================================================
// Pipeline summary
// ============================================================================

/**
 * Build a summary of the governed core evolution pipeline state.
 */
export function buildGovernedCoreSummary(): {
  totalPromotions: number;
  admitted: number;
  rejected: number;
  deferred: number;
  creatorOnly: number;
  totalDeployments: number;
  runningDeployments: number;
  validatedDeployments: number;
  rolledBackDeployments: number;
  totalWatches: number;
  criticalWatches: number;
  rollbackRequired: number;
} {
  const promotions = getAdmittedPromotions();
  const allPromotions = getAllPromotionDecisionsForSummary();

  return {
    totalPromotions: allPromotions.length,
    admitted: promotions.length,
    rejected: allPromotions.filter((p) => p.promotionStatus === "rejected").length,
    deferred: allPromotions.filter((p) => p.promotionStatus === "deferred").length,
    creatorOnly: allPromotions.filter((p) => p.promotionStatus === "creator_only").length,
    totalDeployments: getAllDeploymentsForSummary().length,
    runningDeployments: getRunningDeploymentsForSummary().length,
    validatedDeployments: getValidatedDeploymentsForSummary().length,
    rolledBackDeployments: getRolledBackDeploymentsForSummary().length,
    totalWatches: getAllWatchesForSummary().length,
    criticalWatches: getCriticalWatchesForSummary().length,
    rollbackRequired: getRollbackRequiredWatches().length,
  };
}

// Import helpers for summary (re-imported to avoid circular dependencies)
import {
  getAllPromotionDecisions,
  getRejectedPromotions,
} from "./voiceCoreKnowledgePromotion.js";
import {
  getAllDeployments,
  getRunningDeployments,
  getValidatedDeployments,
  getRolledBackDeployments,
} from "./voiceCorePatternDeployment.js";
import {
  getAllIntegrityWatches,
  getCriticalWatches,
  getWatchesRequiringAction,
} from "./voiceCoreIntegritySentinel.js";

function getAllPromotionDecisionsForSummary() {
  return getAllPromotionDecisions();
}

function getAllDeploymentsForSummary() {
  return getAllDeployments();
}

function getRunningDeploymentsForSummary() {
  return getRunningDeployments();
}

function getValidatedDeploymentsForSummary() {
  return getValidatedDeployments();
}

function getRolledBackDeploymentsForSummary() {
  return getRolledBackDeployments();
}

function getAllWatchesForSummary() {
  return getAllIntegrityWatches();
}

function getCriticalWatchesForSummary() {
  return getCriticalWatches();
}

function getRollbackRequiredWatches() {
  return getWatchesRequiringAction().filter(
    (w) => w.recommendedAction === "rollback_from_core",
  );
}

// ============================================================================
// Formatter
// ============================================================================

export function formatGovernedCoreEvolutionResult(
  result: VoiceGovernedCoreEvolutionResult,
): string {
  const statusEmoji: Record<VoiceGovernedCoreEvolutionResult["pipelineStatus"], string> = {
    admitted_and_deployed: "✅🚀",
    admitted_pending: "✅⏳",
    rejected: "❌",
    deferred: "⏸️",
    creator_only: "🔒",
  };

  const lines = [
    `═══════════════════════════════════════════════════════`,
    `🏛️ Voice Governed Core Evolution — Result`,
    `═══════════════════════════════════════════════════════`,
    ``,
    `Status: ${statusEmoji[result.pipelineStatus]} ${result.pipelineStatus}`,
    ``,
    `--- V9.1: Constitutional Promotion ---`,
    `• decision ID: ${result.promotion.decisionId}`,
    `• template ID: ${result.promotion.templateId}`,
    `• status: ${result.promotion.promotionStatus}`,
    `• scope: ${result.promotion.promotionScope}`,
    `• review: ${result.promotion.requiredReviewMode}`,
    `• constitutional checks: ${result.promotion.constitutionalChecks.filter((c) => c.passed).length}/${result.promotion.constitutionalChecks.length} passed`,
  ];

  if (result.deployment) {
    lines.push(
      ``,
      `--- V9.2: Staged Deployment ---`,
      `• deployment ID: ${result.deployment.deploymentId}`,
      `• mode: ${result.deployment.deploymentMode}`,
      `• status: ${result.deployment.deploymentStatus}`,
      `• validation window: ${Math.round(result.deployment.validationWindowMs / 1000)}s`,
    );
  }

  if (result.integrityWatch) {
    lines.push(
      ``,
      `--- V9.3: Integrity Watch ---`,
      `• watch ID: ${result.integrityWatch.watchId}`,
      `• score: ${result.integrityWatch.integrityScore}%`,
      `• status: ${result.integrityWatch.watchStatus}`,
      `• action: ${result.integrityWatch.recommendedAction}`,
    );
  }

  lines.push(``);
  lines.push(`═══════════════════════════════════════════════════════`);

  return lines.join("\n");
}

export function formatGovernedCoreSummary(): string {
  const summary = buildGovernedCoreSummary();

  const lines = [
    `📊 Voice Governed Core Evolution — Summary`,
    ``,
    `Promotions:`,
    `  • total: ${summary.totalPromotions}`,
    `  • ✅ admitted: ${summary.admitted}`,
    `  • ❌ rejected: ${summary.rejected}`,
    `  • ⏸️ deferred: ${summary.deferred}`,
    `  • 🔒 creator only: ${summary.creatorOnly}`,
    ``,
    `Deployments:`,
    `  • total: ${summary.totalDeployments}`,
    `  • ▶️ running: ${summary.runningDeployments}`,
    `  • ✅ validated: ${summary.validatedDeployments}`,
    `  • ↩️ rolled back: ${summary.rolledBackDeployments}`,
    ``,
    `Integrity Watches:`,
    `  • total: ${summary.totalWatches}`,
    `  • 🔴 critical: ${summary.criticalWatches}`,
    `  • ↩️ rollback required: ${summary.rollbackRequired}`,
  ];

  return lines.join("\n");
}
