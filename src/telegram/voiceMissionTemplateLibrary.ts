/**
 * Voice Mission Template Library & Reuse Engine v8.6
 *
 * First-class entity: VoiceMissionTemplate
 *
 * This layer answers:
 *   - "Which knowledge patterns should become reusable mission templates?"
 *   - "Under what conditions can a template be applied?"
 *   - "How successful has this template been in practice?"
 *
 * This layer does NOT:
 *   - extract knowledge (delegated to V8.5)
 *   - run feedback loops (delegated to V8.7)
 *
 * RULE: NO TEMPLATE WITHOUT VERIFIED MULTI-MISSION SUCCESS
 */

import type { VoiceMissionKnowledge, VoiceKnowledgePatternType, VoiceMissionKnowledgeRegistry } from "./voiceMissionKnowledgeExtraction.js";
import type { VoiceMissionActionType } from "./voiceMissionExecutionGraph.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceMissionTemplateType =
  | "stabilization_flow"
  | "recovery_flow"
  | "learning_optimization"
  | "risk_reduction";

export interface VoiceMissionTemplate {
  templateId: string;

  basedOnKnowledgeIds: string[];

  templateType: VoiceMissionTemplateType;

  graphSkeleton: {
    nodes: string[]; // action type labels (e.g., "observe", "validate", "adapt")
    dependencies: Record<string, string[]>; // node label → dependencies (labels)
  };

  applicabilityConditions: {
    context: string[]; // environment types where this template works
    riskLevel: string[]; // risk levels where applicable
    domains: string[]; // domain types where applicable
  };

  successRate: number; // 0..100

  usageCount: number;

  createdAt: number;

  // Metadata
  description: string;
  createdBy: "system" | "human" | "promotion";
  verificationStatus: "draft" | "verified" | "deprecated";
  minMissionCount: number; // minimum missions needed to verify
  actualMissionCount: number; // actual missions this was derived from
}

export type VoiceMissionTemplateValidationError =
  | "invalid_template_type"
  | "no_knowledge_ids"
  | "empty_graph_skeleton"
  | "success_rate_out_of_range"
  | "negative_usage_count"
  | "empty_description";

// ============================================================================
// ID generation
// ============================================================================

function generateTemplateId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(3);
  return `voice_template_${timestamp}_${random}`;
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

const VALID_TEMPLATE_TYPES: VoiceMissionTemplateType[] = [
  "stabilization_flow",
  "recovery_flow",
  "learning_optimization",
  "risk_reduction",
];

export function validateMissionTemplate(
  template: Partial<VoiceMissionTemplate>,
): VoiceMissionTemplateValidationError[] {
  const errors: VoiceMissionTemplateValidationError[] = [];

  if (
    template.templateType &&
    !VALID_TEMPLATE_TYPES.includes(template.templateType)
  ) {
    errors.push("invalid_template_type");
  }

  if (
    !template.basedOnKnowledgeIds ||
    template.basedOnKnowledgeIds.length === 0
  ) {
    errors.push("no_knowledge_ids");
  }

  if (
    template.graphSkeleton &&
    (!template.graphSkeleton.nodes || template.graphSkeleton.nodes.length === 0)
  ) {
    errors.push("empty_graph_skeleton");
  }

  if (
    template.successRate !== undefined &&
    (template.successRate < 0 || template.successRate > 100)
  ) {
    errors.push("success_rate_out_of_range");
  }

  if (template.usageCount !== undefined && template.usageCount < 0) {
    errors.push("negative_usage_count");
  }

  if (
    template.description !== undefined &&
    template.description.trim().length === 0
  ) {
    errors.push("empty_description");
  }

  return errors;
}

// ============================================================================
// Template type mapping from mission type
// ============================================================================

function mapMissionTypeToTemplateType(
  missionType: string,
  hasRecovery: boolean,
  hasFailure: boolean,
): VoiceMissionTemplateType {
  if (hasRecovery || hasFailure) return "recovery_flow";
  if (missionType === "stabilize_system") return "stabilization_flow";
  if (missionType === "improve_learning_quality") return "learning_optimization";
  if (missionType === "reduce_risk" || missionType === "recover_from_crisis") {
    return "risk_reduction";
  }
  return "stabilization_flow";
}

// ============================================================================
// Template creation from knowledge
// ============================================================================

export interface VoiceTemplateCreationInput {
  knowledgeRecords: VoiceMissionKnowledge[];
  minPatternConfidence: number; // minimum pattern confidence to include (default 50)
  minReusabilityScore: number; // minimum knowledge reusability (default 60)
}

/**
 * Create a template from one or more knowledge records.
 * Pure function — extracts graph skeleton and applicability conditions.
 */
export function createVoiceMissionTemplate(
  input: VoiceTemplateCreationInput,
): {
  template: VoiceMissionTemplate;
  validationErrors: VoiceMissionTemplateValidationError[];
} {
  const { knowledgeRecords } = input;

  if (knowledgeRecords.length === 0) {
    throw new Error("Cannot create template from empty knowledge list");
  }

  // Determine template type from dominant mission type
  const missionTypeCounts = new Map<string, number>();
  for (const k of knowledgeRecords) {
    missionTypeCounts.set(
      k.missionType,
      (missionTypeCounts.get(k.missionType) ?? 0) + 1,
    );
  }
  const dominantMissionType = [...missionTypeCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0][0];

  const hasRecovery = knowledgeRecords.some((k) => k.recoveryTriggered);
  const hasFailure = knowledgeRecords.some((k) => k.failedNodes > 0);

  const templateType = mapMissionTypeToTemplateType(
    dominantMissionType,
    hasRecovery,
    hasFailure,
  );

  // Build graph skeleton from patterns
  const graphSkeleton = buildGraphSkeletonFromKnowledge(knowledgeRecords);

  // Build applicability conditions
  const applicabilityConditions = buildApplicabilityConditions(knowledgeRecords);

  // Calculate success rate from knowledge records
  const completedMissions = knowledgeRecords.filter(
    (k) => k.missionOutcome === "completed",
  ).length;
  const successRate = Math.round(
    (completedMissions / knowledgeRecords.length) * 100,
  );

  // Collect all knowledge IDs
  const basedOnKnowledgeIds = knowledgeRecords.map((k) => k.knowledgeId);

  const template: VoiceMissionTemplate = {
    templateId: generateTemplateId(),
    basedOnKnowledgeIds,
    templateType,
    graphSkeleton,
    applicabilityConditions,
    successRate,
    usageCount: 0,
    createdAt: Date.now(),
    description: `Auto-generated ${templateType} template from ${knowledgeRecords.length} mission(s)`,
    createdBy: "system",
    verificationStatus: "draft",
    minMissionCount: 3, // need 3+ missions to verify
    actualMissionCount: knowledgeRecords.length,
  };

  const validationErrors = validateMissionTemplate(template);

  return { template, validationErrors };
}

// ============================================================================
// Graph skeleton construction
// ============================================================================

function buildGraphSkeletonFromKnowledge(
  knowledgeRecords: VoiceMissionKnowledge[],
): {
  nodes: string[];
  dependencies: Record<string, string[]>;
} {
  // Extract common action sequences from successful patterns
  const actionSequences: string[][] = [];

  for (const knowledge of knowledgeRecords) {
    const successfulPatterns = knowledge.extractedPatterns.filter(
      (p) => p.type === "successful_sequence",
    );

    for (const pattern of successfulPatterns) {
      // Extract action types from pattern description
      const actions = extractActionTypesFromPattern(pattern);
      if (actions.length > 0) {
        actionSequences.push(actions);
      }
    }
  }

  // Find common subsequence across all sequences
  const commonActions = findCommonActions(actionSequences);

  // Build dependencies (sequential by default)
  const dependencies: Record<string, string[]> = {};
  for (let i = 1; i < commonActions.length; i++) {
    dependencies[commonActions[i]] = [commonActions[i - 1]];
  }

  return {
    nodes: commonActions,
    dependencies,
  };
}

function extractActionTypesFromPattern(
  pattern: { description: string },
): string[] {
  // Parse action types from pattern description like:
  // "Successful execution chain: observe@domain_1 → validate@domain_1 → adapt@domain_1"
  const actionRegex = /(\w+)@/g;
  const actions: string[] = [];
  let match;

  while ((match = actionRegex.exec(pattern.description)) !== null) {
    actions.push(match[1]);
  }

  return actions;
}

function findCommonActions(sequences: string[][]): string[] {
  if (sequences.length === 0) return [];
  if (sequences.length === 1) return sequences[0];

  // Find longest common subsequence
  let common = sequences[0];

  for (let i = 1; i < sequences.length; i++) {
    common = longestCommonSubsequence(common, sequences[i]);
  }

  return common;
}

function longestCommonSubsequence(
  a: string[],
  b: string[],
): string[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Reconstruct LCS
  const result: string[] = [];
  let i = m,
    j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

// ============================================================================
// Applicability conditions
// ============================================================================

function buildApplicabilityConditions(
  knowledgeRecords: VoiceMissionKnowledge[],
): VoiceMissionTemplate["applicabilityConditions"] {
  const contexts = new Set<string>();
  const riskLevels = new Set<string>();
  const domains = new Set<string>();

  for (const k of knowledgeRecords) {
    // Map mission type to context
    contexts.add(k.missionType);

    // Map health score to risk level
    if (k.finalHealthScore < 30) riskLevels.add("critical");
    else if (k.finalHealthScore < 50) riskLevels.add("high");
    else if (k.finalHealthScore < 70) riskLevels.add("medium");
    else riskLevels.add("low");

    for (const domain of k.domainCoverage) {
      domains.add(domain);
    }
  }

  return {
    context: [...contexts],
    riskLevel: [...riskLevels],
    domains: [...domains],
  };
}

// ============================================================================
// Template verification
// ============================================================================

/**
 * Verify a template based on accumulated knowledge.
 * A template becomes verified when it has sufficient mission count and success rate.
 */
export function verifyVoiceMissionTemplate(
  template: VoiceMissionTemplate,
  newKnowledgeRecords: VoiceMissionKnowledge[],
): VoiceMissionTemplate {
  const totalMissions = template.actualMissionCount + newKnowledgeRecords.length;
  const totalCompleted =
    template.actualMissionCount * (template.successRate / 100) +
    newKnowledgeRecords.filter((k) => k.missionOutcome === "completed").length;

  const newSuccessRate = Math.round(
    (totalCompleted / totalMissions) * 100,
  );

  let verificationStatus = template.verificationStatus;

  // Auto-verify if enough missions and high success rate
  if (
    totalMissions >= template.minMissionCount &&
    newSuccessRate >= 70
  ) {
    verificationStatus = "verified";
  }

  // Deprecate if success rate drops too low
  if (newSuccessRate < 40 && totalMissions >= 5) {
    verificationStatus = "deprecated";
  }

  return {
    ...template,
    successRate: newSuccessRate,
    actualMissionCount: totalMissions,
    verificationStatus,
  };
}

/**
 * Record template usage.
 */
export function recordTemplateUsage(
  template: VoiceMissionTemplate,
  missionOutcome: "completed" | "aborted" | "blocked" | "failed",
): VoiceMissionTemplate {
  const newUsageCount = template.usageCount + 1;
  const totalMissions = template.actualMissionCount + 1;

  const completedCount =
    template.actualMissionCount * (template.successRate / 100) +
    (missionOutcome === "completed" ? 1 : 0);

  const newSuccessRate = Math.round(
    (completedCount / totalMissions) * 100,
  );

  return {
    ...template,
    usageCount: newUsageCount,
    successRate: newSuccessRate,
    actualMissionCount: totalMissions,
  };
}

// ============================================================================
// Template matching
// ============================================================================

export interface VoiceTemplateMatchInput {
  missionType: string;
  environmentContext: string;
  riskLevel: string;
  targetDomains: string[];
}

/**
 * Find templates that match the given mission context.
 */
export function findMatchingTemplates(
  templates: VoiceMissionTemplate[],
  input: VoiceTemplateMatchInput,
): { template: VoiceMissionTemplate; matchScore: number }[] {
  const scored = templates
    .filter((t) => t.verificationStatus !== "deprecated")
    .map((t) => {
      let score = 0;
      let maxScore = 0;

      // Mission type match
      maxScore += 30;
      if (t.applicabilityConditions.context.includes(input.missionType)) {
        score += 30;
      }

      // Risk level match
      maxScore += 20;
      if (t.applicabilityConditions.riskLevel.includes(input.riskLevel)) {
        score += 20;
      }

      // Domain overlap
      maxScore += 30;
      const domainOverlap = t.applicabilityConditions.domains.filter(
        (d) => input.targetDomains.includes(d),
      ).length;
      if (input.targetDomains.length > 0) {
        score += (domainOverlap / input.targetDomains.length) * 30;
      }

      // Success rate bonus
      maxScore += 20;
      score += (t.successRate / 100) * 20;

      const matchScore = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

      return { template: t, matchScore };
    })
    .filter((r) => r.matchScore >= 50)
    .sort((a, b) => b.matchScore - a.matchScore);

  return scored;
}

// ============================================================================
// Template registry
// ============================================================================

export interface VoiceMissionTemplateRegistry {
  templates: Map<string, VoiceMissionTemplate>;
  maxTemplates: number;
}

const DEFAULT_TEMPLATE_MAX_REGISTRY = 100;

let _templateRegistry: VoiceMissionTemplateRegistry = {
  templates: new Map(),
  maxTemplates: DEFAULT_TEMPLATE_MAX_REGISTRY,
};

export function getVoiceMissionTemplateRegistry(): VoiceMissionTemplateRegistry {
  return {
    templates: new Map(_templateRegistry.templates),
    maxTemplates: _templateRegistry.maxTemplates,
  };
}

export function registerVoiceMissionTemplate(
  template: VoiceMissionTemplate,
): void {
  if (_templateRegistry.templates.size >= _templateRegistry.maxTemplates) {
    throw new Error(
      `Template registry full (max ${_templateRegistry.maxTemplates}). Cannot register ${template.templateId}`,
    );
  }
  _templateRegistry.templates.set(template.templateId, template);
}

export function getVoiceMissionTemplate(
  templateId: string,
): VoiceMissionTemplate | undefined {
  return _templateRegistry.templates.get(templateId);
}

export function getAllVoiceMissionTemplates(): VoiceMissionTemplate[] {
  return Array.from(_templateRegistry.templates.values());
}

export function getTemplatesByType(
  type: VoiceMissionTemplateType,
): VoiceMissionTemplate[] {
  return Array.from(_templateRegistry.templates.values()).filter(
    (t) => t.templateType === type,
  );
}

export function getVerifiedTemplates(): VoiceMissionTemplate[] {
  return Array.from(_templateRegistry.templates.values()).filter(
    (t) => t.verificationStatus === "verified",
  );
}

export function removeVoiceMissionTemplate(templateId: string): boolean {
  return _templateRegistry.templates.delete(templateId);
}

export function clearVoiceMissionTemplateRegistry(): void {
  _templateRegistry = {
    templates: new Map(),
    maxTemplates: DEFAULT_TEMPLATE_MAX_REGISTRY,
  };
}

export function setVoiceMissionTemplateRegistryForTest(
  registry: VoiceMissionTemplateRegistry,
): void {
  _templateRegistry = registry;
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceMissionTemplate(
  template: VoiceMissionTemplate,
): string {
  const typeEmoji: Record<VoiceMissionTemplateType, string> = {
    stabilization_flow: "🔧",
    recovery_flow: "🛡️",
    learning_optimization: "📈",
    risk_reduction: "⚡",
  };

  const statusEmoji: Record<string, string> = {
    draft: "📝",
    verified: "✅",
    deprecated: "❌",
  };

  const lines = [
    `📋 Voice Mission Template`,
    `• template ID: ${template.templateId}`,
    `• type: ${typeEmoji[template.templateType]} ${template.templateType}`,
    `• status: ${statusEmoji[template.verificationStatus] ?? "?"} ${template.verificationStatus}`,
    `• success rate: ${template.successRate}%`,
    `• usage count: ${template.usageCount}`,
    `• missions: ${template.actualMissionCount} (min needed: ${template.minMissionCount})`,
    `• created by: ${template.createdBy}`,
    `• description: ${template.description}`,
    `• based on knowledge: ${template.basedOnKnowledgeIds.length} record(s)`,
    `--- Graph Skeleton ---`,
    `  nodes: ${template.graphSkeleton.nodes.join(" → ") || "none"}`,
    `  dependencies: ${Object.keys(template.graphSkeleton.dependencies).length} edges`,
    `--- Applicability ---`,
    `  contexts: ${template.applicabilityConditions.context.join(", ") || "any"}`,
    `  risk levels: ${template.applicabilityConditions.riskLevel.join(", ") || "any"}`,
    `  domains: ${template.applicabilityConditions.domains.length} domain(s)`,
  ];

  return lines.join("\n");
}
