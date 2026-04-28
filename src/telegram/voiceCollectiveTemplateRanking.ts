/**
 * Voice Collective Template Ranking & Generalization Layer v8.9
 *
 * First-class entity: VoiceCollectiveTemplateScore
 *
 * This layer answers:
 *   - "Is this template a local hack or a core pattern?"
 *   - "How transferable is this template across contexts?"
 *   - "What is the overall rank and recommended usage?"
 *
 * This layer does NOT:
 *   - create templates (delegated to V8.6)
 *   - govern collective intelligence (delegated to V9.0)
 *   - federate knowledge (delegated to V8.8)
 *
 * RULE: NO TEMPLATE BECOMES CORE WITHOUT COLLECTIVE RANKING
 */

import type { VoiceMissionTemplate } from "./voiceMissionTemplateLibrary.js";
import type { VoiceKnowledgeFederationRecord } from "./voiceKnowledgeFederation.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceTemplateClassification =
  | "local_only"
  | "context_bound"
  | "broadly_reusable"
  | "high_value_core";

export type VoiceTemplateRecommendedUsage =
  | "prefer"
  | "use_with_validation"
  | "restricted"
  | "deprecate";

export interface VoiceCollectiveTemplateScore {
  scoreId: string;

  templateId: string;

  dimensions: {
    stabilityScore: number; // 0..100
    transferabilityScore: number; // 0..100
    riskScore: number; // 0..100
    reuseScore: number; // 0..100
  };

  overallRank: number; // 0..100

  classification: VoiceTemplateClassification;

  recommendedUsage: VoiceTemplateRecommendedUsage;

  evaluatedAt: number;

  // Metadata
  evaluationSummary: string;
  supportingFederations?: string[]; // federation IDs that support this template
}

export type VoiceCollectiveRankingValidationError =
  | "invalid_template_id"
  | "stability_out_of_range"
  | "transferability_out_of_range"
  | "risk_out_of_range"
  | "reuse_out_of_range"
  | "overall_rank_out_of_range"
  | "invalid_classification"
  | "invalid_recommended_usage";

// ============================================================================
// ID generation
// ============================================================================

function generateScoreId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(3);
  return `voice_score_${timestamp}_${random}`;
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

const VALID_CLASSIFICATIONS: VoiceTemplateClassification[] = [
  "local_only",
  "context_bound",
  "broadly_reusable",
  "high_value_core",
];

const VALID_USAGES: VoiceTemplateRecommendedUsage[] = [
  "prefer",
  "use_with_validation",
  "restricted",
  "deprecate",
];

export function validateCollectiveTemplateScore(
  score: Partial<VoiceCollectiveTemplateScore>,
): VoiceCollectiveRankingValidationError[] {
  const errors: VoiceCollectiveRankingValidationError[] = [];

  if (!score.templateId || score.templateId.trim().length === 0) {
    errors.push("invalid_template_id");
  }

  if (
    score.dimensions?.stabilityScore !== undefined &&
    (score.dimensions.stabilityScore < 0 || score.dimensions.stabilityScore > 100)
  ) {
    errors.push("stability_out_of_range");
  }

  if (
    score.dimensions?.transferabilityScore !== undefined &&
    (score.dimensions.transferabilityScore < 0 || score.dimensions.transferabilityScore > 100)
  ) {
    errors.push("transferability_out_of_range");
  }

  if (
    score.dimensions?.riskScore !== undefined &&
    (score.dimensions.riskScore < 0 || score.dimensions.riskScore > 100)
  ) {
    errors.push("risk_out_of_range");
  }

  if (
    score.dimensions?.reuseScore !== undefined &&
    (score.dimensions.reuseScore < 0 || score.dimensions.reuseScore > 100)
  ) {
    errors.push("reuse_out_of_range");
  }

  if (
    score.overallRank !== undefined &&
    (score.overallRank < 0 || score.overallRank > 100)
  ) {
    errors.push("overall_rank_out_of_range");
  }

  if (
    score.classification &&
    !VALID_CLASSIFICATIONS.includes(score.classification)
  ) {
    errors.push("invalid_classification");
  }

  if (
    score.recommendedUsage &&
    !VALID_USAGES.includes(score.recommendedUsage)
  ) {
    errors.push("invalid_recommended_usage");
  }

  return errors;
}

// ============================================================================
// Score calculation
// ============================================================================

export interface VoiceCollectiveRankingInput {
  template: VoiceMissionTemplate;
  federations?: VoiceKnowledgeFederationRecord[];
  allTemplates?: VoiceMissionTemplate[]; // for relative ranking
}

/**
 * Calculate collective ranking score for a template.
 * Pure function — evaluates across stability, transferability, risk, and reuse.
 */
export function calculateCollectiveTemplateScore(
  input: VoiceCollectiveRankingInput,
): {
  score: VoiceCollectiveTemplateScore;
  validationErrors: VoiceCollectiveRankingValidationError[];
} {
  const { template } = input;

  // ─── Stability Score ───
  // Based on template success rate and verification status
  let stabilityScore = template.successRate;
  if (template.verificationStatus === "verified") stabilityScore += 10;
  if (template.verificationStatus === "deprecated") stabilityScore -= 30;
  stabilityScore = Math.max(0, Math.min(100, stabilityScore));

  // ─── Transferability Score ───
  // Based on how many different contexts/domains the template works in
  const contextCount = template.applicabilityConditions.context.length;
  const domainCount = template.applicabilityConditions.domains.length;
  const riskLevelCount = template.applicabilityConditions.riskLevel.length;

  let transferabilityScore = 30; // baseline
  transferabilityScore += Math.min(25, contextCount * 8);
  transferabilityScore += Math.min(25, domainCount * 5);
  transferabilityScore += Math.min(20, riskLevelCount * 7);
  transferabilityScore = Math.max(0, Math.min(100, transferabilityScore));

  // ─── Risk Score ───
  // Lower is better; based on failures and recovery triggers
  const knowledgeRecords = input.federations?.flatMap((f) =>
    f.sourceKnowledgeIds.map(() => null),
  ) ?? [];

  let riskScore = 50 - (template.successRate / 2); // baseline inverse of success
  if (template.actualMissionCount >= 5) riskScore -= 10; // more data = lower risk
  riskScore = Math.max(0, Math.min(100, riskScore));

  // ─── Reuse Score ───
  // Based on actual usage count and success rate
  let reuseScore = 30; // baseline
  reuseScore += Math.min(30, template.usageCount * 5);
  reuseScore += Math.min(40, (template.successRate / 100) * 40);
  reuseScore = Math.max(0, Math.min(100, reuseScore));

  // ─── Overall Rank ───
  // Weighted combination
  const overallRank = Math.round(
    stabilityScore * 0.35 +
    transferabilityScore * 0.25 +
    (100 - riskScore) * 0.2 +
    reuseScore * 0.2,
  );

  // ─── Classification ───
  const classification = classifyTemplate({
    transferabilityScore,
    stabilityScore,
    riskScore,
    overallRank,
    contextCount,
    domainCount,
  });

  // ─── Recommended Usage ───
  const recommendedUsage = determineRecommendedUsage(
    classification,
    stabilityScore,
    riskScore,
  );

  // ─── Supporting Federations ───
  const supportingFederations = input.federations
    ?.filter((f) =>
      f.sourceKnowledgeIds.some((kid) =>
        template.basedOnKnowledgeIds.includes(kid),
      ),
    )
    .map((f) => f.federationId);

  const score: VoiceCollectiveTemplateScore = {
    scoreId: generateScoreId(),
    templateId: template.templateId,
    dimensions: {
      stabilityScore,
      transferabilityScore,
      riskScore,
      reuseScore,
    },
    overallRank,
    classification,
    recommendedUsage,
    evaluatedAt: Date.now(),
    evaluationSummary: `rank=${overallRank}, class=${classification}, stability=${stabilityScore}, transfer=${transferabilityScore}, risk=${riskScore}, reuse=${reuseScore}`,
    supportingFederations:
      supportingFederations && supportingFederations.length > 0
        ? supportingFederations
        : undefined,
  };

  const validationErrors = validateCollectiveTemplateScore(score);

  return { score, validationErrors };
}

// ============================================================================
// Classification logic
// ============================================================================

interface ClassificationInput {
  transferabilityScore: number;
  stabilityScore: number;
  riskScore: number;
  overallRank: number;
  contextCount: number;
  domainCount: number;
}

function classifyTemplate(
  input: ClassificationInput,
): VoiceTemplateClassification {
  // High-value core: transferable, stable, low risk
  if (
    input.transferabilityScore > 80 &&
    input.stabilityScore > 80 &&
    input.riskScore < 30 &&
    input.overallRank >= 75
  ) {
    return "high_value_core";
  }

  // Broadly reusable: decent transferability and stability
  if (
    input.transferabilityScore >= 60 &&
    input.stabilityScore >= 60 &&
    input.riskScore < 50
  ) {
    return "broadly_reusable";
  }

  // Context-bound: works but limited contexts
  if (input.contextCount <= 2 || input.domainCount <= 1) {
    return "context_bound";
  }

  // Default: local only
  return "local_only";
}

// ============================================================================
// Recommended usage determination
// ============================================================================

function determineRecommendedUsage(
  classification: VoiceTemplateClassification,
  stabilityScore: number,
  riskScore: number,
): VoiceTemplateRecommendedUsage {
  switch (classification) {
    case "high_value_core":
      if (stabilityScore >= 80 && riskScore < 20) return "prefer";
      return "use_with_validation";

    case "broadly_reusable":
      if (riskScore < 30) return "use_with_validation";
      return "restricted";

    case "context_bound":
      return "restricted";

    case "local_only":
      return "deprecate";

    default:
      return "restricted";
  }
}

// ============================================================================
// Template ranking across ecosystem
// ============================================================================

/**
 * Rank multiple templates collectively and return sorted results.
 */
export function rankTemplatesCollectively(
  templates: VoiceMissionTemplate[],
  federations?: VoiceKnowledgeFederationRecord[],
): {
  template: VoiceMissionTemplate;
  score: VoiceCollectiveTemplateScore;
}[] {
  const scored = templates.map((template) => {
    const { score } = calculateCollectiveTemplateScore({
      template,
      federations,
      allTemplates: templates,
    });
    return { template, score };
  });

  return scored.sort((a, b) => b.score.overallRank - a.score.overallRank);
}

/**
 * Get templates classified as high-value core.
 */
export function getHighValueCoreTemplates(
  ranked: {
    template: VoiceMissionTemplate;
    score: VoiceCollectiveTemplateScore;
  }[],
): {
  template: VoiceMissionTemplate;
  score: VoiceCollectiveTemplateScore;
}[] {
  return ranked.filter(
    (r) => r.score.classification === "high_value_core",
  );
}

/**
 * Get templates that should be deprecated.
 */
export function getDeprecatedTemplates(
  ranked: {
    template: VoiceMissionTemplate;
    score: VoiceCollectiveTemplateScore;
  }[],
): {
  template: VoiceMissionTemplate;
  score: VoiceCollectiveTemplateScore;
}[] {
  return ranked.filter(
    (r) => r.score.recommendedUsage === "deprecate",
  );
}

// ============================================================================
// Score registry
// ============================================================================

export interface VoiceCollectiveScoreRegistry {
  scores: Map<string, VoiceCollectiveTemplateScore>;
  maxScores: number;
}

const DEFAULT_SCORE_MAX_REGISTRY = 200;

let _scoreRegistry: VoiceCollectiveScoreRegistry = {
  scores: new Map(),
  maxScores: DEFAULT_SCORE_MAX_REGISTRY,
};

export function getVoiceCollectiveScoreRegistry(): VoiceCollectiveScoreRegistry {
  return {
    scores: new Map(_scoreRegistry.scores),
    maxScores: _scoreRegistry.maxScores,
  };
}

export function registerCollectiveTemplateScore(
  score: VoiceCollectiveTemplateScore,
): void {
  if (_scoreRegistry.scores.size >= _scoreRegistry.maxScores) {
    throw new Error(
      `Score registry full (max ${_scoreRegistry.maxScores}). Cannot register ${score.scoreId}`,
    );
  }
  _scoreRegistry.scores.set(score.scoreId, score);
}

export function getCollectiveTemplateScore(
  scoreId: string,
): VoiceCollectiveTemplateScore | undefined {
  return _scoreRegistry.scores.get(scoreId);
}

export function getScoreForTemplate(
  templateId: string,
): VoiceCollectiveTemplateScore | undefined {
  return Array.from(_scoreRegistry.scores.values()).find(
    (s) => s.templateId === templateId,
  );
}

export function getAllCollectiveScores(): VoiceCollectiveTemplateScore[] {
  return Array.from(_scoreRegistry.scores.values());
}

export function getScoresByClassification(
  classification: VoiceTemplateClassification,
): VoiceCollectiveTemplateScore[] {
  return Array.from(_scoreRegistry.scores.values()).filter(
    (s) => s.classification === classification,
  );
}

export function removeCollectiveTemplateScore(scoreId: string): boolean {
  return _scoreRegistry.scores.delete(scoreId);
}

export function clearVoiceCollectiveScoreRegistry(): void {
  _scoreRegistry = {
    scores: new Map(),
    maxScores: DEFAULT_SCORE_MAX_REGISTRY,
  };
}

export function setVoiceCollectiveScoreRegistryForTest(
  registry: VoiceCollectiveScoreRegistry,
): void {
  _scoreRegistry = registry;
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceCollectiveTemplateScore(
  score: VoiceCollectiveTemplateScore,
): string {
  const classEmoji: Record<VoiceTemplateClassification, string> = {
    local_only: "📍",
    context_bound: "🔒",
    broadly_reusable: "🔄",
    high_value_core: "💎",
  };

  const usageEmoji: Record<VoiceTemplateRecommendedUsage, string> = {
    prefer: "⭐",
    use_with_validation: "✅",
    restricted: "⚠️",
    deprecate: "❌",
  };

  return [
    `📊 Voice Collective Template Score`,
    `• score ID: ${score.scoreId}`,
    `• template ID: ${score.templateId}`,
    `• classification: ${classEmoji[score.classification]} ${score.classification}`,
    `• overall rank: ${score.overallRank}/100`,
    `• recommended usage: ${usageEmoji[score.recommendedUsage]} ${score.recommendedUsage}`,
    `--- Dimensions ---`,
    `  • stability: ${score.dimensions.stabilityScore}%`,
    `  • transferability: ${score.dimensions.transferabilityScore}%`,
    `  • risk (lower=better): ${score.dimensions.riskScore}%`,
    `  • reuse: ${score.dimensions.reuseScore}%`,
    score.supportingFederations
      ? `• supporting federations: ${score.supportingFederations.join(", ")}`
      : null,
    `• evaluated at: ${new Date(score.evaluatedAt).toISOString()}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatCollectiveTemplateRanking(
  ranked: {
    template: VoiceMissionTemplate;
    score: VoiceCollectiveTemplateScore;
  }[],
): string {
  const lines = [
    `📊 Collective Template Ranking (${ranked.length} templates)`,
    ``,
    `Rank | Template                           | Class              | Usage                | Stability | Transfer | Risk | Reuse`,
    `-----|------------------------------------|--------------------|----------------------|-----------|----------|------|------`,
  ];

  for (let i = 0; i < Math.min(ranked.length, 10); i++) {
    const { template, score } = ranked[i];
    const rankStr = `${score.overallRank}`.padStart(4);
    const templateStr = template.templateId.slice(0, 34).padEnd(34);
    const classStr = score.classification.padEnd(18);
    const usageStr = score.recommendedUsage.padEnd(20);
    lines.push(
      `${rankStr} | ${templateStr} | ${classStr} | ${usageStr} | ${score.dimensions.stabilityScore}% | ${score.dimensions.transferabilityScore}% | ${score.dimensions.riskScore}% | ${score.dimensions.reuseScore}%`,
    );
  }

  if (ranked.length > 10) {
    lines.push(`  ... and ${ranked.length - 10} more`);
  }

  return lines.join("\n");
}
