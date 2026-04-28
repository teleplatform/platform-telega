/**
 * Voice Self-Evolution & Knowledge Feedback Loop Layer v8.7
 *
 * First-class entity: VoiceKnowledgeFeedbackLoop
 *
 * This layer answers:
 *   - "Are applied templates actually improving mission outcomes?"
 *   - "Which templates should be prioritized or deprecated based on real usage?"
 *   - "Is the knowledge feedback loop making the system better or worse?"
 *
 * This layer does NOT:
 *   - extract knowledge (delegated to V8.5)
 *   - create templates (delegated to V8.6)
 *   - federate cross-mission knowledge (delegated to V8.8)
 *
 * RULE: NO KNOWLEDGE MAY MODIFY SYSTEM WITHOUT GOVERNED FEEDBACK LOOP
 */

import type { VoiceMissionTemplate } from "./voiceMissionTemplateLibrary.js";
import type { VoiceGovernanceMission } from "./voiceMissionModel.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceFeedbackLoopStatus =
  | "active"
  | "learning"
  | "optimizing"
  | "stabilized";

export interface VoiceKnowledgeFeedbackLoop {
  loopId: string;

  appliedTemplates: string[]; // template IDs

  affectedMissions: string[]; // mission IDs that used these templates

  performanceImpact: {
    successRateChange: number; // -100..+100 (relative to baseline)
    stabilityImprovement: number; // -100..+100
    riskReduction: number; // -100..+100
  };

  loopStatus: VoiceFeedbackLoopStatus;

  lastEvaluatedAt: number;

  // Metadata
  baselineSuccessRate: number; // success rate before templates were applied
  currentSuccessRate: number; // success rate after templates
  evaluationCount: number;
  createdAt: number;

  // Template quality tracking
  templateOutcomes: Array<{
    templateId: string;
    usageCount: number;
    successCount: number;
    avgHealthScore: number;
    recommendation: "prefer" | "use" | "restrict" | "deprecate";
  }>;
}

export type VoiceFeedbackLoopValidationError =
  | "no_applied_templates"
  | "no_affected_missions"
  | "success_rate_change_out_of_range"
  | "stability_improvement_out_of_range"
  | "risk_reduction_out_of_range"
  | "invalid_loop_status";

// ============================================================================
// ID generation
// ============================================================================

function generateFeedbackLoopId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(3);
  return `voice_feedback_${timestamp}_${random}`;
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

const VALID_LOOP_STATUSES: VoiceFeedbackLoopStatus[] = [
  "active",
  "learning",
  "optimizing",
  "stabilized",
];

export function validateFeedbackLoop(
  loop: Partial<VoiceKnowledgeFeedbackLoop>,
): VoiceFeedbackLoopValidationError[] {
  const errors: VoiceFeedbackLoopValidationError[] = [];

  if (
    !loop.appliedTemplates ||
    loop.appliedTemplates.length === 0
  ) {
    errors.push("no_applied_templates");
  }

  if (
    !loop.affectedMissions ||
    loop.affectedMissions.length === 0
  ) {
    errors.push("no_affected_missions");
  }

  if (
    loop.performanceImpact?.successRateChange !== undefined &&
    (loop.performanceImpact.successRateChange < -100 ||
      loop.performanceImpact.successRateChange > 100)
  ) {
    errors.push("success_rate_change_out_of_range");
  }

  if (
    loop.performanceImpact?.stabilityImprovement !== undefined &&
    (loop.performanceImpact.stabilityImprovement < -100 ||
      loop.performanceImpact.stabilityImprovement > 100)
  ) {
    errors.push("stability_improvement_out_of_range");
  }

  if (
    loop.performanceImpact?.riskReduction !== undefined &&
    (loop.performanceImpact.riskReduction < -100 ||
      loop.performanceImpact.riskReduction > 100)
  ) {
    errors.push("risk_reduction_out_of_range");
  }

  if (
    loop.loopStatus &&
    !VALID_LOOP_STATUSES.includes(loop.loopStatus)
  ) {
    errors.push("invalid_loop_status");
  }

  return errors;
}

// ============================================================================
// Feedback loop creation
// ============================================================================

export interface VoiceFeedbackLoopInput {
  templates: VoiceMissionTemplate[];
  baselineSuccessRate: number; // overall success rate before templates
  missionOutcomes: Array<{
    missionId: string;
    templateId: string;
    success: boolean;
    healthScore: number;
  }>;
}

/**
 * Create a feedback loop from template usage.
 * Pure function — computes performance impact and recommendations.
 */
export function createVoiceKnowledgeFeedbackLoop(
  input: VoiceFeedbackLoopInput,
): {
  loop: VoiceKnowledgeFeedbackLoop;
  validationErrors: VoiceFeedbackLoopValidationError[];
} {
  const appliedTemplates = input.templates.map((t) => t.templateId);
  const affectedMissions = input.missionOutcomes.map((m) => m.missionId);

  // Calculate current success rate
  const totalMissions = input.missionOutcomes.length;
  const successfulMissions = input.missionOutcomes.filter(
    (m) => m.success,
  ).length;
  const currentSuccessRate =
    totalMissions > 0
      ? Math.round((successfulMissions / totalMissions) * 100)
      : input.baselineSuccessRate;

  // Calculate performance impact
  const successRateChange = currentSuccessRate - input.baselineSuccessRate;

  // Stability improvement: based on average health scores
  const avgHealthScore =
    input.missionOutcomes.length > 0
      ? input.missionOutcomes.reduce(
          (sum, m) => sum + m.healthScore,
          0,
        ) / input.missionOutcomes.length
      : 50;
  const stabilityImprovement = Math.round(avgHealthScore - 50); // 50 is baseline

  // Risk reduction: proxy based on success rate improvement
  const riskReduction = Math.max(
    -50,
    Math.min(50, successRateChange * 0.8),
  );

  // Determine loop status
  const loopStatus = determineLoopStatus(
    successRateChange,
    stabilityImprovement,
    input.missionOutcomes.length,
  );

  // Calculate per-template outcomes
  const templateOutcomes = calculateTemplateOutcomes(
    input.templates,
    input.missionOutcomes,
  );

  const loop: VoiceKnowledgeFeedbackLoop = {
    loopId: generateFeedbackLoopId(),
    appliedTemplates,
    affectedMissions,
    performanceImpact: {
      successRateChange,
      stabilityImprovement,
      riskReduction,
    },
    loopStatus,
    lastEvaluatedAt: Date.now(),
    baselineSuccessRate: input.baselineSuccessRate,
    currentSuccessRate,
    evaluationCount: 1,
    createdAt: Date.now(),
    templateOutcomes,
  };

  const validationErrors = validateFeedbackLoop(loop);

  return { loop, validationErrors };
}

// ============================================================================
// Loop status determination
// ============================================================================

function determineLoopStatus(
  successRateChange: number,
  stabilityImprovement: number,
  missionCount: number,
): VoiceFeedbackLoopStatus {
  // Not enough data yet
  if (missionCount < 3) return "learning";

  // Consistently improving
  if (successRateChange > 10 && stabilityImprovement > 10) {
    return "stabilized";
  }

  // Improving but not yet stable
  if (successRateChange > 0 && stabilityImprovement > 0) {
    return "optimizing";
  }

  // Default active state
  return "active";
}

// ============================================================================
// Template outcome calculation
// ============================================================================

function calculateTemplateOutcomes(
  templates: VoiceMissionTemplate[],
  missionOutcomes: VoiceFeedbackLoopInput["missionOutcomes"],
): VoiceKnowledgeFeedbackLoop["templateOutcomes"] {
  return templates.map((template) => {
    const usages = missionOutcomes.filter(
      (m) => m.templateId === template.templateId,
    );

    const successCount = usages.filter((m) => m.success).length;
    const avgHealthScore =
      usages.length > 0
        ? Math.round(
            usages.reduce((sum, m) => sum + m.healthScore, 0) / usages.length,
          )
        : 50;

    // Determine recommendation
    const recommendation = determineTemplateRecommendation(
      usages.length,
      successCount,
      avgHealthScore,
      template.successRate,
    );

    return {
      templateId: template.templateId,
      usageCount: usages.length,
      successCount,
      avgHealthScore,
      recommendation,
    };
  });
}

function determineTemplateRecommendation(
  usageCount: number,
  successCount: number,
  avgHealthScore: number,
  templateSuccessRate: number,
): "prefer" | "use" | "restrict" | "deprecate" {
  if (usageCount === 0) return "use"; // not yet tested

  const successRate = (successCount / usageCount) * 100;

  // Strong performer
  if (successRate >= 80 && avgHealthScore >= 70) return "prefer";

  // Good performer
  if (successRate >= 60 && avgHealthScore >= 50) return "use";

  // Marginal — restrict usage
  if (successRate >= 40) return "restrict";

  // Poor performer — deprecate
  return "deprecate";
}

// ============================================================================
// Feedback loop evaluation
// ============================================================================

/**
 * Re-evaluate an existing feedback loop with new mission outcomes.
 */
export function evaluateVoiceKnowledgeFeedbackLoop(
  loop: VoiceKnowledgeFeedbackLoop,
  newMissionOutcomes: VoiceFeedbackLoopInput["missionOutcomes"],
): VoiceKnowledgeFeedbackLoop {
  const allOutcomes = [
    ...loop.affectedMissions.map((missionId) => ({
      missionId,
      templateId: loop.appliedTemplates[0] ?? "unknown",
      success: true, // historical assumption
      healthScore: 50, // baseline
    })),
    ...newMissionOutcomes,
  ];

  const totalMissions = allOutcomes.length;
  const successfulMissions = allOutcomes.filter((m) => m.success).length;
  const currentSuccessRate = Math.round(
    (successfulMissions / totalMissions) * 100,
  );

  const successRateChange = currentSuccessRate - loop.baselineSuccessRate;

  const avgHealthScore =
    allOutcomes.reduce((sum, m) => sum + m.healthScore, 0) / totalMissions;
  const stabilityImprovement = Math.round(avgHealthScore - 50);
  const riskReduction = Math.max(-50, Math.min(50, successRateChange * 0.8));

  const loopStatus = determineLoopStatus(
    successRateChange,
    stabilityImprovement,
    totalMissions,
  );

  return {
    ...loop,
    affectedMissions: [...new Set([...loop.affectedMissions, ...newMissionOutcomes.map((m) => m.missionId)])],
    performanceImpact: {
      successRateChange,
      stabilityImprovement,
      riskReduction,
    },
    loopStatus,
    currentSuccessRate,
    evaluationCount: loop.evaluationCount + 1,
    lastEvaluatedAt: Date.now(),
  };
}

// ============================================================================
// Template recommendation enforcement
// ============================================================================

/**
 * Apply recommendations from a feedback loop to templates.
 * Returns the list of actions taken.
 */
export function enforceTemplateRecommendations(
  loop: VoiceKnowledgeFeedbackLoop,
  templates: VoiceMissionTemplate[],
): Array<{
  templateId: string;
  action: "upgrade" | "downgrade" | "deprecate" | "no_change";
  reason: string;
}> {
  const actions: Array<{
    templateId: string;
    action: "upgrade" | "downgrade" | "deprecate" | "no_change";
    reason: string;
  }> = [];

  for (const outcome of loop.templateOutcomes) {
    const template = templates.find((t) => t.templateId === outcome.templateId);
    if (!template) continue;

    switch (outcome.recommendation) {
      case "prefer":
        if (template.verificationStatus !== "verified") {
          actions.push({
            templateId: outcome.templateId,
            action: "upgrade",
            reason: `High performer: ${outcome.successCount}/${outcome.usageCount} success, avg health ${outcome.avgHealthScore}%`,
          });
        } else {
          actions.push({
            templateId: outcome.templateId,
            action: "no_change",
            reason: "Already verified and performing well",
          });
        }
        break;

      case "use":
        actions.push({
          templateId: outcome.templateId,
          action: "no_change",
          reason: `Steady performer: ${outcome.successCount}/${outcome.usageCount}`,
        });
        break;

      case "restrict":
        actions.push({
          templateId: outcome.templateId,
          action: "downgrade",
          reason: `Marginal performer: ${outcome.successCount}/${outcome.usageCount}, avg health ${outcome.avgHealthScore}%`,
        });
        break;

      case "deprecate":
        actions.push({
          templateId: outcome.templateId,
          action: "deprecate",
          reason: `Poor performer: ${outcome.successCount}/${outcome.usageCount}, avg health ${outcome.avgHealthScore}%`,
        });
        break;
    }
  }

  return actions;
}

// ============================================================================
// Feedback loop registry
// ============================================================================

export interface VoiceFeedbackLoopRegistry {
  loops: Map<string, VoiceKnowledgeFeedbackLoop>;
  maxLoops: number;
}

const DEFAULT_FEEDBACK_MAX_REGISTRY = 50;

let _feedbackRegistry: VoiceFeedbackLoopRegistry = {
  loops: new Map(),
  maxLoops: DEFAULT_FEEDBACK_MAX_REGISTRY,
};

export function getVoiceFeedbackLoopRegistry(): VoiceFeedbackLoopRegistry {
  return {
    loops: new Map(_feedbackRegistry.loops),
    maxLoops: _feedbackRegistry.maxLoops,
  };
}

export function registerVoiceKnowledgeFeedbackLoop(
  loop: VoiceKnowledgeFeedbackLoop,
): void {
  if (_feedbackRegistry.loops.size >= _feedbackRegistry.maxLoops) {
    throw new Error(
      `Feedback loop registry full (max ${_feedbackRegistry.maxLoops}). Cannot register ${loop.loopId}`,
    );
  }
  _feedbackRegistry.loops.set(loop.loopId, loop);
}

export function getVoiceKnowledgeFeedbackLoop(
  loopId: string,
): VoiceKnowledgeFeedbackLoop | undefined {
  return _feedbackRegistry.loops.get(loopId);
}

export function getAllVoiceKnowledgeFeedbackLoops(): VoiceKnowledgeFeedbackLoop[] {
  return Array.from(_feedbackRegistry.loops.values());
}

export function getActiveFeedbackLoops(): VoiceKnowledgeFeedbackLoop[] {
  return Array.from(_feedbackRegistry.loops.values()).filter(
    (l) => l.loopStatus === "active" || l.loopStatus === "optimizing",
  );
}

export function removeVoiceKnowledgeFeedbackLoop(loopId: string): boolean {
  return _feedbackRegistry.loops.delete(loopId);
}

export function clearVoiceKnowledgeFeedbackLoopRegistry(): void {
  _feedbackRegistry = {
    loops: new Map(),
    maxLoops: DEFAULT_FEEDBACK_MAX_REGISTRY,
  };
}

export function setVoiceKnowledgeFeedbackLoopRegistryForTest(
  registry: VoiceFeedbackLoopRegistry,
): void {
  _feedbackRegistry = registry;
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceKnowledgeFeedbackLoop(
  loop: VoiceKnowledgeFeedbackLoop,
): string {
  const statusEmoji: Record<VoiceFeedbackLoopStatus, string> = {
    active: "🔄",
    learning: "📚",
    optimizing: "📈",
    stabilized: "✅",
  };

  const recommendationEmoji: Record<string, string> = {
    prefer: "⭐",
    use: "✅",
    restrict: "⚠️",
    deprecate: "❌",
  };

  const lines = [
    `🔁 Voice Knowledge Feedback Loop`,
    `• loop ID: ${loop.loopId}`,
    `• status: ${statusEmoji[loop.loopStatus]} ${loop.loopStatus}`,
    `• applied templates: ${loop.appliedTemplates.length}`,
    `• affected missions: ${loop.affectedMissions.length}`,
    `• baseline success: ${loop.baselineSuccessRate}%`,
    `• current success: ${loop.currentSuccessRate}%`,
    `• success rate change: ${loop.performanceImpact.successRateChange > 0 ? "+" : ""}${loop.performanceImpact.successRateChange}%`,
    `• stability improvement: ${loop.performanceImpact.stabilityImprovement > 0 ? "+" : ""}${loop.performanceImpact.stabilityImprovement}%`,
    `• risk reduction: ${loop.performanceImpact.riskReduction > 0 ? "+" : ""}${loop.performanceImpact.riskReduction}%`,
    `• evaluations: ${loop.evaluationCount}`,
    `• last evaluated: ${new Date(loop.lastEvaluatedAt).toISOString()}`,
    `--- Template Recommendations ---`,
  ];

  for (const outcome of loop.templateOutcomes) {
    lines.push(
      `  ${recommendationEmoji[outcome.recommendation] ?? "?"} ${outcome.templateId}: ${outcome.successCount}/${outcome.usageCount} success, health=${outcome.avgHealthScore}% → ${outcome.recommendation}`,
    );
  }

  return lines.join("\n");
}
