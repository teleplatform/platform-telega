/**
 * Voice Core Knowledge Promotion — Constitutional Admission Layer v9.1
 *
 * First-class entity: VoiceCoreKnowledgePromotionDecision
 *
 * This layer answers:
 *   - "Does this collective knowledge have the constitutional right to enter core?"
 *   - "What scope should this knowledge operate in?"
 *   - "Does this require human or creator review?"
 *
 * This layer does NOT:
 *   - deploy knowledge to core (delegated to V9.2)
 *   - monitor core integrity after deployment (delegated to V9.3)
 *   - rank templates (delegated to V8.9)
 *
 * RULE: NO COLLECTIVE KNOWLEDGE ENTERS CORE WITHOUT CONSTITUTIONAL PROMOTION DECISION
 */

import type {
  VoiceCollectiveTemplateScore,
  VoiceTemplateClassification,
} from "./voiceCollectiveTemplateRanking.js";
import type { VoiceCollectiveIntelligenceGovernor } from "./voiceCollectiveGovernor.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoicePromotionStatus =
  | "admitted"
  | "rejected"
  | "deferred"
  | "creator_only";

export type VoicePromotionScope =
  | "local_domain"
  | "multi_domain"
  | "core_global";

export type VoiceRequiredReviewMode =
  | "standard"
  | "human_required"
  | "creator_only"
  | "blocked";

export type VoiceConstitutionalCheck =
  | "safety_preservation"
  | "human_control_preservation"
  | "audit_integrity"
  | "consistency_preservation"
  | "goal_alignment"
  | "context_portability";

export interface VoiceConstitutionalCheckResult {
  check: VoiceConstitutionalCheck;
  passed: boolean;
  reason?: string;
}

export interface VoiceCoreKnowledgePromotionDecision {
  decisionId: string;

  templateId: string;
  federationId?: string;

  promotionStatus: VoicePromotionStatus;

  constitutionalChecks: VoiceConstitutionalCheckResult[];

  promotionScope: VoicePromotionScope;
  requiredReviewMode: VoiceRequiredReviewMode;

  // Evidence trace
  templateScore?: VoiceCollectiveTemplateScore;
  governorMode?: string;

  decidedAt: number;
}

export type VoicePromotionValidationError =
  | "invalid_template_id"
  | "invalid_promotion_status"
  | "invalid_promotion_scope"
  | "invalid_review_mode"
  | "missing_constitutional_checks"
  | "incomplete_constitutional_checks";

// ============================================================================
// ID generation
// ============================================================================

function generatePromotionDecisionId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(3);
  return `voice_promo_${timestamp}_${random}`;
}

function cryptoRandomHex(bytes: number): string {
  try {
    const { randomBytes } = require("node:crypto");
    return randomBytes(bytes).toString("hex");
  } catch {
    return Math.random().toString(16).slice(2, 2 + bytes * 2);
  }
}

// ============================================================================
// Validation
// ============================================================================

const VALID_PROMOTION_STATUSES: VoicePromotionStatus[] = [
  "admitted",
  "rejected",
  "deferred",
  "creator_only",
];

const VALID_PROMOTION_SCOPES: VoicePromotionScope[] = [
  "local_domain",
  "multi_domain",
  "core_global",
];

const VALID_REVIEW_MODES: VoiceRequiredReviewMode[] = [
  "standard",
  "human_required",
  "creator_only",
  "blocked",
];

const ALL_CONSTITUTIONAL_CHECKS: VoiceConstitutionalCheck[] = [
  "safety_preservation",
  "human_control_preservation",
  "audit_integrity",
  "consistency_preservation",
  "goal_alignment",
  "context_portability",
];

export function validatePromotionDecision(
  decision: Partial<VoiceCoreKnowledgePromotionDecision>,
): VoicePromotionValidationError[] {
  const errors: VoicePromotionValidationError[] = [];

  if (!decision.templateId || decision.templateId.trim().length === 0) {
    errors.push("invalid_template_id");
  }

  if (
    decision.promotionStatus &&
    !VALID_PROMOTION_STATUSES.includes(decision.promotionStatus)
  ) {
    errors.push("invalid_promotion_status");
  }

  if (
    decision.promotionScope &&
    !VALID_PROMOTION_SCOPES.includes(decision.promotionScope)
  ) {
    errors.push("invalid_promotion_scope");
  }

  if (
    decision.requiredReviewMode &&
    !VALID_REVIEW_MODES.includes(decision.requiredReviewMode)
  ) {
    errors.push("invalid_review_mode");
  }

  if (!decision.constitutionalChecks || decision.constitutionalChecks.length === 0) {
    errors.push("missing_constitutional_checks");
  } else {
    const checkTypes = new Set(decision.constitutionalChecks.map((c) => c.check));
    for (const requiredCheck of ALL_CONSTITUTIONAL_CHECKS) {
      if (!checkTypes.has(requiredCheck)) {
        errors.push("incomplete_constitutional_checks");
        break;
      }
    }
  }

  return errors;
}

// ============================================================================
// Promotion decision logic
// ============================================================================

export interface VoiceCorePromotionInput {
  templateId: string;
  federationId?: string;
  score: VoiceCollectiveTemplateScore;
  touchesSensitiveCore: boolean;
  governor?: VoiceCollectiveIntelligenceGovernor;
}

/**
 * Decide whether collective knowledge may enter core.
 * Pure function — applies constitutional checks and promotion policy.
 */
export function decideCorePromotion(
  input: VoiceCorePromotionInput,
): VoiceCoreKnowledgePromotionDecision {
  const { templateId, federationId, score, touchesSensitiveCore } = input;
  const governor = input.governor;

  // ─── Constitutional Checks ───
  const constitutionalChecks: VoiceConstitutionalCheckResult[] = [
    {
      check: "safety_preservation",
      passed: score.dimensions.riskScore < 70,
      reason:
        score.dimensions.riskScore >= 70
          ? `Risk score ${score.dimensions.riskScore} exceeds safety threshold 70`
          : undefined,
    },
    {
      check: "human_control_preservation",
      passed: true, // templates don't remove human control by design
      reason: undefined,
    },
    {
      check: "audit_integrity",
      passed: !touchesSensitiveCore,
      reason: touchesSensitiveCore
        ? "Template touches sensitive core audit path"
        : undefined,
    },
    {
      check: "consistency_preservation",
      passed: score.dimensions.riskScore < 80,
      reason:
        score.dimensions.riskScore >= 80
          ? `Risk score ${score.dimensions.riskScore} threatens consistency`
          : undefined,
    },
    {
      check: "goal_alignment",
      passed: score.overallRank >= 60,
      reason:
        score.overallRank < 60
          ? `Overall rank ${score.overallRank} below goal alignment threshold 60`
          : undefined,
    },
    {
      check: "context_portability",
      passed: score.dimensions.transferabilityScore >= 50,
      reason:
        score.dimensions.transferabilityScore < 50
          ? `Transferability ${score.dimensions.transferabilityScore} below portability threshold 50`
          : undefined,
    },
  ];

  const allChecksPassed = constitutionalChecks.every((c) => c.passed);
  const failedChecks = constitutionalChecks.filter((c) => !c.passed);

  // ─── Sensitive core override: creator_only ───
  if (touchesSensitiveCore) {
    return {
      decisionId: generatePromotionDecisionId(),
      templateId,
      federationId,
      promotionStatus: "creator_only",
      constitutionalChecks,
      promotionScope: "core_global",
      requiredReviewMode: "creator_only",
      templateScore: score,
      governorMode: governor?.authorityMode,
      decidedAt: Date.now(),
    };
  }

  // ─── Failed constitutional checks: rejected ───
  if (!allChecksPassed) {
    return {
      decisionId: generatePromotionDecisionId(),
      templateId,
      federationId,
      promotionStatus: "rejected",
      constitutionalChecks,
      promotionScope: "local_domain",
      requiredReviewMode: "blocked",
      templateScore: score,
      governorMode: governor?.authorityMode,
      decidedAt: Date.now(),
    };
  }

  // ─── Governor promotion policy check ───
  const policy = governor?.promotionPolicy ?? {
    minSupportMissions: 3,
    minOverallRank: 60,
    maxRiskScore: 50,
  };

  if (score.dimensions.riskScore > policy.maxRiskScore) {
    return {
      decisionId: generatePromotionDecisionId(),
      templateId,
      federationId,
      promotionStatus: "rejected",
      constitutionalChecks,
      promotionScope: "local_domain",
      requiredReviewMode: "blocked",
      templateScore: score,
      governorMode: governor?.authorityMode,
      decidedAt: Date.now(),
    };
  }

  if (score.overallRank < policy.minOverallRank) {
    return {
      decisionId: generatePromotionDecisionId(),
      templateId,
      federationId,
      promotionStatus: "deferred",
      constitutionalChecks,
      promotionScope: "local_domain",
      requiredReviewMode: "human_required",
      templateScore: score,
      governorMode: governor?.authorityMode,
      decidedAt: Date.now(),
    };
  }

  // ─── Determine scope based on classification and transferability ───
  let promotionScope: VoicePromotionScope;
  if (
    score.classification === "high_value_core" &&
    score.dimensions.transferabilityScore >= 80
  ) {
    promotionScope = "core_global";
  } else if (
    score.classification === "broadly_reusable" ||
    score.dimensions.transferabilityScore >= 60
  ) {
    promotionScope = "multi_domain";
  } else {
    promotionScope = "local_domain";
  }

  // ─── Determine review mode based on risk ───
  let requiredReviewMode: VoiceRequiredReviewMode;
  if (score.dimensions.riskScore >= 50) {
    requiredReviewMode = "human_required";
  } else if (score.dimensions.riskScore >= 30) {
    requiredReviewMode = "standard";
  } else {
    requiredReviewMode = "standard";
  }

  // ─── Final promotion status ───
  const promotionStatus: VoicePromotionStatus =
    score.classification === "high_value_core" && allChecksPassed
      ? "admitted"
      : score.classification === "local_only"
        ? "deferred"
        : "admitted";

  return {
    decisionId: generatePromotionDecisionId(),
    templateId,
    federationId,
    promotionStatus,
    constitutionalChecks,
    promotionScope,
    requiredReviewMode,
    templateScore: score,
    governorMode: governor?.authorityMode,
    decidedAt: Date.now(),
  };
}

// ============================================================================
// Promotion registry
// ============================================================================

export interface VoicePromotionRegistry {
  decisions: Map<string, VoiceCoreKnowledgePromotionDecision>;
  maxDecisions: number;
}

const DEFAULT_PROMOTION_MAX = 200;

let _promotionRegistry: VoicePromotionRegistry = {
  decisions: new Map(),
  maxDecisions: DEFAULT_PROMOTION_MAX,
};

export function registerPromotionDecision(
  decision: VoiceCoreKnowledgePromotionDecision,
): void {
  if (_promotionRegistry.decisions.size >= _promotionRegistry.maxDecisions) {
    throw new Error(
      `Promotion registry full (max ${_promotionRegistry.maxDecisions}). Cannot register ${decision.decisionId}`,
    );
  }
  _promotionRegistry.decisions.set(decision.decisionId, decision);
}

export function getPromotionDecision(
  decisionId: string,
): VoiceCoreKnowledgePromotionDecision | undefined {
  return _promotionRegistry.decisions.get(decisionId);
}

export function getPromotionDecisionForTemplate(
  templateId: string,
): VoiceCoreKnowledgePromotionDecision | undefined {
  return Array.from(_promotionRegistry.decisions.values()).find(
    (d) => d.templateId === templateId,
  );
}

export function getAllPromotionDecisions(): VoiceCoreKnowledgePromotionDecision[] {
  return Array.from(_promotionRegistry.decisions.values());
}

export function getAdmittedPromotions(): VoiceCoreKnowledgePromotionDecision[] {
  return Array.from(_promotionRegistry.decisions.values()).filter(
    (d) => d.promotionStatus === "admitted",
  );
}

export function getRejectedPromotions(): VoiceCoreKnowledgePromotionDecision[] {
  return Array.from(_promotionRegistry.decisions.values()).filter(
    (d) => d.promotionStatus === "rejected",
  );
}

export function removePromotionDecision(decisionId: string): boolean {
  return _promotionRegistry.decisions.delete(decisionId);
}

export function clearPromotionRegistry(): void {
  _promotionRegistry = {
    decisions: new Map(),
    maxDecisions: DEFAULT_PROMOTION_MAX,
  };
}

export function setPromotionRegistryForTest(
  registry: VoicePromotionRegistry,
): void {
  _promotionRegistry = registry;
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceCoreKnowledgePromotionDecision(
  decision: VoiceCoreKnowledgePromotionDecision,
): string {
  const statusEmoji: Record<VoicePromotionStatus, string> = {
    admitted: "✅",
    rejected: "❌",
    deferred: "⏸️",
    creator_only: "🔒",
  };

  const scopeEmoji: Record<VoicePromotionScope, string> = {
    local_domain: "📍",
    multi_domain: "🌐",
    core_global: "🏛️",
  };

  const reviewEmoji: Record<VoiceRequiredReviewMode, string> = {
    standard: "📋",
    human_required: "👤",
    creator_only: "🔐",
    blocked: "🚫",
  };

  const checkEmoji = (passed: boolean) => (passed ? "✅" : "❌");

  const lines = [
    `🏛️ Voice Core Knowledge Promotion Decision`,
    `• decision ID: ${decision.decisionId}`,
    `• template ID: ${decision.templateId}`,
    decision.federationId ? `• federation ID: ${decision.federationId}` : null,
    `• status: ${statusEmoji[decision.promotionStatus]} ${decision.promotionStatus}`,
    `• scope: ${scopeEmoji[decision.promotionScope]} ${decision.promotionScope}`,
    `• review: ${reviewEmoji[decision.requiredReviewMode]} ${decision.requiredReviewMode}`,
    `--- Constitutional Checks ---`,
  ];

  for (const check of decision.constitutionalChecks) {
    lines.push(
      `  ${checkEmoji(check.passed)} ${check.check}${check.reason ? `: ${check.reason}` : ""}`,
    );
  }

  if (decision.templateScore) {
    lines.push(`--- Template Score ---`);
    lines.push(
      `  • rank: ${decision.templateScore.overallRank}`,
    );
    lines.push(
      `  • stability: ${decision.templateScore.dimensions.stabilityScore}%`,
    );
    lines.push(
      `  • transferability: ${decision.templateScore.dimensions.transferabilityScore}%`,
    );
    lines.push(
      `  • risk: ${decision.templateScore.dimensions.riskScore}%`,
    );
  }

  lines.push(`• decided at: ${new Date(decision.decidedAt).toISOString()}`);

  return lines.filter(Boolean).join("\n");
}
