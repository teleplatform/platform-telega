/**
 * Voice Collective Intelligence Governor & Global Knowledge Authority Layer v9.0
 *
 * First-class entity: VoiceCollectiveIntelligenceGovernor
 *
 * This layer answers:
 *   - "Which collective knowledge is strong enough to influence the core?"
 *   - "What is the authority mode for the current knowledge state?"
 *   - "Should this template be promoted, curated, restricted, or observed?"
 *
 * This layer does NOT:
 *   - federate knowledge (delegated to V8.8)
 *   - rank templates (delegated to V8.9)
 *   - admit knowledge to core constitutionally (delegated to V9.1)
 *
 * RULE: NO COLLECTIVE KNOWLEDGE MAY ENTER CORE WITHOUT GOVERNOR APPROVAL
 */

import type { VoiceMissionTemplate } from "./voiceMissionTemplateLibrary.js";
import type {
  VoiceCollectiveTemplateScore,
  VoiceTemplateClassification,
} from "./voiceCollectiveTemplateRanking.js";
import type { VoiceKnowledgeFederationRecord } from "./voiceKnowledgeFederation.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceAuthorityMode =
  | "observing"
  | "curating"
  | "promoting"
  | "restricting";

export type VoiceKnowledgeHealth =
  | "healthy"
  | "noisy"
  | "fragmented"
  | "overloaded";

export interface VoiceCollectiveIntelligenceGovernor {
  governorId: string;

  activeFederations: string[]; // federation IDs
  rankedTemplates: string[]; // template IDs

  authorityMode: VoiceAuthorityMode;

  promotionPolicy: {
    minSupportMissions: number;
    minOverallRank: number;
    maxRiskScore: number;
  };

  globalKnowledgeHealth: VoiceKnowledgeHealth;

  lastEvaluatedAt: number;

  // Metadata
  evaluationSummary: string;
  totalKnowledgeRecords: number;
  totalFederations: number;
  totalTemplates: number;
}

export type VoiceGovernorValidationError =
  | "no_active_federations"
  | "no_ranked_templates"
  | "invalid_authority_mode"
  | "invalid_knowledge_health"
  | "min_support_missions_invalid"
  | "min_overall_rank_invalid"
  | "max_risk_score_invalid";

// ============================================================================
// ID generation
// ============================================================================

function generateGovernorId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(3);
  return `voice_governor_${timestamp}_${random}`;
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

const VALID_AUTHORITY_MODES: VoiceAuthorityMode[] = [
  "observing",
  "curating",
  "promoting",
  "restricting",
];

const VALID_KNOWLEDGE_HEALTHS: VoiceKnowledgeHealth[] = [
  "healthy",
  "noisy",
  "fragmented",
  "overloaded",
];

export function validateGovernor(
  governor: Partial<VoiceCollectiveIntelligenceGovernor>,
): VoiceGovernorValidationError[] {
  const errors: VoiceGovernorValidationError[] = [];

  if (
    governor.authorityMode &&
    !VALID_AUTHORITY_MODES.includes(governor.authorityMode)
  ) {
    errors.push("invalid_authority_mode");
  }

  if (
    governor.globalKnowledgeHealth &&
    !VALID_KNOWLEDGE_HEALTHS.includes(governor.globalKnowledgeHealth)
  ) {
    errors.push("invalid_knowledge_health");
  }

  if (
    governor.promotionPolicy?.minSupportMissions !== undefined &&
    governor.promotionPolicy.minSupportMissions < 1
  ) {
    errors.push("min_support_missions_invalid");
  }

  if (
    governor.promotionPolicy?.minOverallRank !== undefined &&
    (governor.promotionPolicy.minOverallRank < 0 ||
      governor.promotionPolicy.minOverallRank > 100)
  ) {
    errors.push("min_overall_rank_invalid");
  }

  if (
    governor.promotionPolicy?.maxRiskScore !== undefined &&
    (governor.promotionPolicy.maxRiskScore < 0 ||
      governor.promotionPolicy.maxRiskScore > 100)
  ) {
    errors.push("max_risk_score_invalid");
  }

  return errors;
}

// ============================================================================
// Default promotion policy
// ============================================================================

const DEFAULT_PROMOTION_POLICY = {
  minSupportMissions: 3,
  minOverallRank: 60,
  maxRiskScore: 50,
};

// ============================================================================
// Governor evaluation
// ============================================================================

export interface VoiceGovernorEvaluationInput {
  federations: VoiceKnowledgeFederationRecord[];
  rankedTemplates: {
    template: VoiceMissionTemplate;
    score: VoiceCollectiveTemplateScore;
  }[];
  totalKnowledgeRecords: number;
}

/**
 * Evaluate the collective intelligence governor state.
 * Pure function — determines authority mode and knowledge health.
 */
export function evaluateCollectiveGovernor(
  input: VoiceGovernorEvaluationInput,
): {
  governor: VoiceCollectiveIntelligenceGovernor;
  validationErrors: VoiceGovernorValidationError[];
} {
  const { federations, rankedTemplates, totalKnowledgeRecords } = input;

  // ─── Determine authority mode ───
  const authorityMode = determineAuthorityMode(
    federations,
    rankedTemplates,
  );

  // ─── Determine global knowledge health ───
  const globalKnowledgeHealth = determineKnowledgeHealth(
    federations,
    rankedTemplates,
    totalKnowledgeRecords,
  );

  // ─── Active federations and ranked templates ───
  const activeFederations = federations
    .filter((f) => f.portabilityScore >= 50)
    .map((f) => f.federationId);

  const rankedTemplateIds = rankedTemplates.map((r) => r.template.templateId);

  const governor: VoiceCollectiveIntelligenceGovernor = {
    governorId: generateGovernorId(),
    activeFederations,
    rankedTemplates: rankedTemplateIds,
    authorityMode,
    promotionPolicy: { ...DEFAULT_PROMOTION_POLICY },
    globalKnowledgeHealth,
    lastEvaluatedAt: Date.now(),
    evaluationSummary: `mode=${authorityMode}, health=${globalKnowledgeHealth}, federations=${federations.length}, templates=${rankedTemplates.length}`,
    totalKnowledgeRecords,
    totalFederations: federations.length,
    totalTemplates: rankedTemplates.length,
  };

  const validationErrors = validateGovernor(governor);

  return { governor, validationErrors };
}

// ============================================================================
// Authority mode determination
// ============================================================================

function determineAuthorityMode(
  federations: VoiceKnowledgeFederationRecord[],
  rankedTemplates: {
    template: VoiceMissionTemplate;
    score: VoiceCollectiveTemplateScore;
  }[],
): VoiceAuthorityMode {
  // Restricting: noisy/contradictory knowledge or many low-quality templates
  const noisyFederations = federations.filter(
    (f) => f.portabilityScore < 40,
  ).length;
  const lowQualityTemplates = rankedTemplates.filter(
    (r) => r.score.recommendedUsage === "deprecate",
  ).length;

  if (
    noisyFederations > federations.length * 0.5 ||
    lowQualityTemplates > rankedTemplates.length * 0.5
  ) {
    return "restricting";
  }

  // Promoting: strong federations and high-value core templates exist
  const strongFederations = federations.filter(
    (f) => f.portabilityScore >= 70,
  ).length;
  const highValueCore = rankedTemplates.filter(
    (r) => r.score.classification === "high_value_core",
  ).length;

  if (strongFederations >= 2 && highValueCore >= 1) {
    return "promoting";
  }

  // Curating: some signal, but not yet strong enough for promotion
  if (federations.length >= 2 && rankedTemplates.length >= 3) {
    return "curating";
  }

  // Default: observing
  return "observing";
}

// ============================================================================
// Knowledge health determination
// ============================================================================

function determineKnowledgeHealth(
  federations: VoiceKnowledgeFederationRecord[],
  rankedTemplates: {
    template: VoiceMissionTemplate;
    score: VoiceCollectiveTemplateScore;
  }[],
  totalKnowledgeRecords: number,
): VoiceKnowledgeHealth {
  // Overloaded: too many records without clear structure
  if (totalKnowledgeRecords > 200 && federations.length < 5) {
    return "overloaded";
  }

  // Noisy: many low-portability federations
  const noisyFederations = federations.filter(
    (f) => f.portabilityScore < 40,
  ).length;
  if (noisyFederations > federations.length * 0.4 && federations.length > 2) {
    return "noisy";
  }

  // Fragmented: federations exist but don't connect well
  if (
    federations.length >= 3 &&
    rankedTemplates.filter(
      (r) => r.score.classification === "local_only",
    ).length > rankedTemplates.length * 0.5
  ) {
    return "fragmented";
  }

  // Default: healthy
  return "healthy";
}

// ============================================================================
// Governor approval for core entry
// ============================================================================

export interface VoiceGovernorApprovalInput {
  template: VoiceMissionTemplate;
  score: VoiceCollectiveTemplateScore;
  federationSupport?: number; // number of supporting federations
}

export interface VoiceGovernorApprovalResult {
  approved: boolean;
  reason: string;
  requiredAction?: "observe" | "curate" | "promote" | "restrict";
}

/**
 * Check if a template is approved by the governor for core influence.
 * Pure function — applies promotion policy rules.
 */
export function approveForCore(
  input: VoiceGovernorApprovalInput,
  governor: VoiceCollectiveIntelligenceGovernor,
): VoiceGovernorApprovalResult {
  const { template, score } = input;

  // Check minimum support missions
  if (template.actualMissionCount < governor.promotionPolicy.minSupportMissions) {
    return {
      approved: false,
      reason: `Insufficient mission support: ${template.actualMissionCount} < ${governor.promotionPolicy.minSupportMissions}`,
      requiredAction: "observe",
    };
  }

  // Check minimum overall rank
  if (score.overallRank < governor.promotionPolicy.minOverallRank) {
    return {
      approved: false,
      reason: `Overall rank too low: ${score.overallRank} < ${governor.promotionPolicy.minOverallRank}`,
      requiredAction: "curate",
    };
  }

  // Check maximum risk score
  if (score.dimensions.riskScore > governor.promotionPolicy.maxRiskScore) {
    return {
      approved: false,
      reason: `Risk score too high: ${score.dimensions.riskScore} > ${governor.promotionPolicy.maxRiskScore}`,
      requiredAction: "restrict",
    };
  }

  // Check classification
  if (
    score.classification !== "high_value_core" &&
    score.classification !== "broadly_reusable"
  ) {
    return {
      approved: false,
      reason: `Classification not eligible for core: ${score.classification}`,
      requiredAction: "curate",
    };
  }

  // All checks passed
  const requiredAction =
    score.classification === "high_value_core" ? "promote" : "curate";

  return {
    approved: true,
    reason: `Template approved for core influence: rank=${score.overallRank}, classification=${score.classification}`,
    requiredAction,
  };
}

// ============================================================================
// Governor singleton
// ============================================================================

let _currentGovernor: VoiceCollectiveIntelligenceGovernor | null = null;

export function getCurrentGovernor(): VoiceCollectiveIntelligenceGovernor | null {
  return _currentGovernor ? { ..._currentGovernor } : null;
}

export function setCurrentGovernor(
  governor: VoiceCollectiveIntelligenceGovernor,
): void {
  _currentGovernor = governor;
}

export function clearCurrentGovernor(): void {
  _currentGovernor = null;
}

export function setGovernorForTest(
  governor: VoiceCollectiveIntelligenceGovernor | null,
): void {
  _currentGovernor = governor;
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceCollectiveGovernor(
  governor: VoiceCollectiveIntelligenceGovernor,
): string {
  const modeEmoji: Record<VoiceAuthorityMode, string> = {
    observing: "👁️",
    curating: "🔧",
    promoting: "🚀",
    restricting: "🚫",
  };

  const healthEmoji: Record<VoiceKnowledgeHealth, string> = {
    healthy: "🟢",
    noisy: "🟡",
    fragmented: "🟠",
    overloaded: "🔴",
  };

  return [
    `🏛️ Voice Collective Intelligence Governor`,
    `• governor ID: ${governor.governorId}`,
    `• authority mode: ${modeEmoji[governor.authorityMode]} ${governor.authorityMode}`,
    `• knowledge health: ${healthEmoji[governor.globalKnowledgeHealth]} ${governor.globalKnowledgeHealth}`,
    `• evaluation: ${governor.evaluationSummary}`,
    `--- Statistics ---`,
    `  • knowledge records: ${governor.totalKnowledgeRecords}`,
    `  • federations: ${governor.totalFederations} (${governor.activeFederations.length} active)`,
    `  • templates: ${governor.totalTemplates} (${governor.rankedTemplates.length} ranked)`,
    `--- Promotion Policy ---`,
    `  • min support missions: ${governor.promotionPolicy.minSupportMissions}`,
    `  • min overall rank: ${governor.promotionPolicy.minOverallRank}`,
    `  • max risk score: ${governor.promotionPolicy.maxRiskScore}`,
    `• last evaluated: ${new Date(governor.lastEvaluatedAt).toISOString()}`,
  ].join("\n");
}
