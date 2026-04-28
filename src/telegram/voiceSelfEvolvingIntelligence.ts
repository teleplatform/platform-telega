/**
 * Voice Self-Evolving Mission Intelligence — Integration Orchestrator v8.7
 *
 * Wires together V8.5–V8.7:
 *
 *   mission completion → knowledge extraction → template creation
 *   → template matching → feedback loop → system evolution
 *
 * Layers:
 *   V8.5 — VoiceMissionKnowledge (knowledge extraction from missions)
 *   V8.6 — VoiceMissionTemplate (template library and reuse)
 *   V8.7 — VoiceKnowledgeFeedbackLoop (self-evolution feedback)
 */

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type {
  VoiceMissionKnowledge,
  VoiceKnowledgePattern,
  VoiceKnowledgePatternType,
} from "./voiceMissionKnowledgeExtraction.js";

export type {
  VoiceMissionTemplate,
  VoiceMissionTemplateType,
} from "./voiceMissionTemplateLibrary.js";

export type {
  VoiceKnowledgeFeedbackLoop,
  VoiceFeedbackLoopStatus,
} from "./voiceKnowledgeFeedbackLoop.js";

// ============================================================================
// Core imports
// ============================================================================

import {
  extractMissionKnowledge,
  registerVoiceMissionKnowledge,
  getHighReusabilityKnowledge,
  getKnowledgeForMission,
  type VoiceMissionKnowledge,
  type VoiceKnowledgeExtractionInput,
} from "./voiceMissionKnowledgeExtraction.js";

import {
  createVoiceMissionTemplate,
  verifyVoiceMissionTemplate,
  findMatchingTemplates,
  recordTemplateUsage,
  registerVoiceMissionTemplate,
  getVoiceMissionTemplate,
  getVerifiedTemplates,
  getAllVoiceMissionTemplates,
  type VoiceMissionTemplate,
  type VoiceTemplateMatchInput,
} from "./voiceMissionTemplateLibrary.js";

import {
  createVoiceKnowledgeFeedbackLoop,
  evaluateVoiceKnowledgeFeedbackLoop,
  enforceTemplateRecommendations,
  registerVoiceKnowledgeFeedbackLoop,
  type VoiceKnowledgeFeedbackLoop,
  type VoiceFeedbackLoopInput,
} from "./voiceKnowledgeFeedbackLoop.js";

import type { VoiceGovernanceMission, VoiceMissionStatus } from "./voiceMissionModel.js";
import type { VoiceMissionExecutionGraph } from "./voiceMissionExecutionGraph.js";
import type { VoiceMissionSupervisor } from "./voiceMissionSupervision.js";

// ============================================================================
// Integration pipeline
// ============================================================================

/**
 * Full self-evolution pipeline result.
 */
export interface VoiceSelfEvolvingIntelligenceResult {
  // V8.5 — Knowledge extraction
  knowledge?: VoiceMissionKnowledge;

  // V8.6 — Template creation/matching
  newTemplates: VoiceMissionTemplate[];
  matchingTemplates: { template: VoiceMissionTemplate; matchScore: number }[];

  // V8.7 — Feedback loop
  feedbackLoop?: VoiceKnowledgeFeedbackLoop;
  templateActions: Array<{
    templateId: string;
    action: "upgrade" | "downgrade" | "deprecate" | "no_change";
    reason: string;
  }>;

  // Summary
  summary: string;
}

/**
 * Execute the full self-evolution pipeline after mission completion.
 *
 * Pipeline flow:
 *   1. Extract knowledge from completed mission (V8.5)
 *   2. Check if patterns warrant new template creation (V8.6)
 *   3. Find existing templates that match future mission contexts (V8.6)
 *   4. Evaluate feedback loop from accumulated template usage (V8.7)
 *   5. Enforce template recommendations (V8.7)
 */
export function executeSelfEvolvingPipeline(
  mission: VoiceGovernanceMission,
  graph: VoiceMissionExecutionGraph,
  supervisor?: VoiceMissionSupervisor,
  recoveryTriggered: boolean = false,
  replanTriggered: boolean = false,
): VoiceSelfEvolvingIntelligenceResult {
  const newTemplates: VoiceMissionTemplate[] = [];
  const templateActions: Array<{
    templateId: string;
    action: "upgrade" | "downgrade" | "deprecate" | "no_change";
    reason: string;
  }> = [];

  // ─── Step 1: Extract knowledge (V8.5) ───
  const knowledgeInput: VoiceKnowledgeExtractionInput = {
    mission,
    graph,
    supervisor,
    recoveryTriggered,
    replanTriggered,
    detectedRisks: supervisor?.detectedRisks ?? [],
  };

  const { knowledge } = extractMissionKnowledge(knowledgeInput);
  registerVoiceMissionKnowledge(knowledge);

  // ─── Step 2: Check if template creation is warranted (V8.6) ───
  // Template creation needs multi-mission patterns — check existing knowledge
  const existingKnowledge = getKnowledgeForMission(mission.missionType as string);
  const highReusability = getHighReusabilityKnowledge(70);

  // If we have enough high-reusability knowledge, create a template
  if (highReusability.length >= 2) {
    const { template, validationErrors } = createVoiceMissionTemplate({
      knowledgeRecords: highReusability.slice(0, 5), // use top 5
      minPatternConfidence: 50,
      minReusabilityScore: 60,
    });

    if (validationErrors.length === 0) {
      registerVoiceMissionTemplate(template);
      newTemplates.push(template);
    }
  }

  // ─── Step 3: Find matching templates for future use (V8.6) ───
  const matchInput: VoiceTemplateMatchInput = {
    missionType: mission.missionType,
    environmentContext: "production", // default — would come from V7.3
    riskLevel: supervisor?.missionHealthScore != null && supervisor.missionHealthScore < 50 ? "high" : "low",
    targetDomains: mission.targetDomains,
  };

  const allTemplates = getAllVoiceMissionTemplates();
  const matchingTemplates = findMatchingTemplates(allTemplates, matchInput);

  // ─── Step 4: Evaluate feedback loop (V8.7) ───
  let feedbackLoop: VoiceKnowledgeFeedbackLoop | undefined;

  const verifiedTemplates = getVerifiedTemplates();
  if (verifiedTemplates.length > 0 && mission.missionStatus === "completed") {
    // Record usage for matched templates
    for (const match of matchingTemplates.slice(0, 1)) {
      const updatedTemplate = recordTemplateUsage(
        match.template,
        mission.missionStatus as "completed" | "aborted" | "blocked" | "failed",
      );
      registerVoiceMissionTemplate(updatedTemplate);
    }

    // Create feedback loop from template outcomes
    const feedbackInput: VoiceFeedbackLoopInput = {
      templates: verifiedTemplates,
      baselineSuccessRate: 60, // baseline assumption
      missionOutcomes: matchingTemplates.map((m) => ({
        missionId: mission.missionId,
        templateId: m.template.templateId,
        success: mission.missionStatus === "completed",
        healthScore: supervisor?.missionHealthScore ?? 50,
      })),
    };

    const { loop } = createVoiceKnowledgeFeedbackLoop(feedbackInput);
    registerVoiceKnowledgeFeedbackLoop(loop);
    feedbackLoop = loop;
  }

  // ─── Step 5: Enforce template recommendations (V8.7) ───
  if (feedbackLoop) {
    const actions = enforceTemplateRecommendations(
      feedbackLoop,
      verifiedTemplates,
    );
    templateActions.push(...actions);
  }

  // ─── Build summary ───
  const summary = buildPipelineSummary(knowledge, newTemplates, matchingTemplates, feedbackLoop);

  return {
    knowledge,
    newTemplates,
    matchingTemplates,
    feedbackLoop,
    templateActions,
    summary,
  };
}

/**
 * Execute template-matching pipeline for a new mission (without completion).
 * This is used at mission PLANNING time to find reusable templates.
 */
export function findTemplatesForMission(
  missionType: string,
  targetDomains: string[],
  riskLevel: "low" | "medium" | "high" | "critical",
): { template: VoiceMissionTemplate; matchScore: number }[] {
  const matchInput: VoiceTemplateMatchInput = {
    missionType,
    environmentContext: "production",
    riskLevel,
    targetDomains,
  };

  const allTemplates = getAllVoiceMissionTemplates();
  return findMatchingTemplates(allTemplates, matchInput);
}

// ============================================================================
// Summary builder
// ============================================================================

function buildPipelineSummary(
  knowledge: VoiceMissionKnowledge,
  newTemplates: VoiceMissionTemplate[],
  matchingTemplates: { template: VoiceMissionTemplate; matchScore: number }[],
  feedbackLoop?: VoiceKnowledgeFeedbackLoop,
): string {
  const parts: string[] = [];

  parts.push(
    `Knowledge extracted: ${knowledge.extractedPatterns.length} patterns, reusability=${knowledge.reusabilityScore}%`,
  );

  if (newTemplates.length > 0) {
    parts.push(`New templates created: ${newTemplates.map((t) => t.templateType).join(", ")}`);
  }

  if (matchingTemplates.length > 0) {
    parts.push(
      `Matching templates found: ${matchingTemplates.length} (best=${matchingTemplates[0].matchScore}%)`,
    );
  } else {
    parts.push("No matching templates found");
  }

  if (feedbackLoop) {
    parts.push(
      `Feedback loop: status=${feedbackLoop.loopStatus}, success change=${feedbackLoop.performanceImpact.successRateChange > 0 ? "+" : ""}${feedbackLoop.performanceImpact.successRateChange}%`,
    );
  }

  return parts.join(" | ");
}

// ============================================================================
// Formatter
// ============================================================================

export function formatSelfEvolvingIntelligenceResult(
  result: VoiceSelfEvolvingIntelligenceResult,
): string {
  const lines = [
    `═══════════════════════════════════════════════════════`,
    `🧠 Voice Self-Evolving Mission Intelligence — Result`,
    `═══════════════════════════════════════════════════════`,
    ``,
    result.summary,
    ``,
  ];

  if (result.knowledge) {
    lines.push(`--- Knowledge Extracted (${result.knowledge.extractedPatterns.length} patterns) ---`);
    for (const pattern of result.knowledge.extractedPatterns.slice(0, 3)) {
      lines.push(`  • ${pattern.type}: ${pattern.description.slice(0, 80)}...`);
    }
  }

  if (result.newTemplates.length > 0) {
    lines.push(`--- New Templates Created ---`);
    for (const template of result.newTemplates) {
      lines.push(`  • ${template.templateType} [${template.verificationStatus}] success=${template.successRate}%`);
    }
  }

  if (result.matchingTemplates.length > 0) {
    lines.push(`--- Matching Templates ---`);
    for (const match of result.matchingTemplates.slice(0, 3)) {
      lines.push(`  • ${match.template.templateType} match=${match.matchScore}%`);
    }
  }

  if (result.templateActions.length > 0) {
    lines.push(`--- Template Actions ---`);
    for (const action of result.templateActions) {
      lines.push(`  • ${action.templateId}: ${action.action} — ${action.reason.slice(0, 60)}...`);
    }
  }

  lines.push(``);
  lines.push(`═══════════════════════════════════════════════════════`);

  return lines.join("\n");
}
