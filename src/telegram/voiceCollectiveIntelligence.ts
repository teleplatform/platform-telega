/**
 * Voice Collective Mission Intelligence — Integration Orchestrator v9.0
 *
 * Wires together V8.8–V9.0:
 *
 *   mission knowledge → cross-mission federation → collective template ranking
 *   → governor approval → core entry gate
 *
 * Layers:
 *   V8.8 — VoiceKnowledgeFederation (clusters patterns across missions)
 *   V8.9 — VoiceCollectiveTemplateRanking (classifies and ranks templates)
 *   V9.0 — VoiceCollectiveGovernor (global knowledge authority)
 */

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type {
  VoiceKnowledgeFederationRecord,
  VoiceFederationType,
  VoiceFederationSharedPattern,
} from "./voiceKnowledgeFederation.js";

export type {
  VoiceCollectiveTemplateScore,
  VoiceTemplateClassification,
  VoiceTemplateRecommendedUsage,
} from "./voiceCollectiveTemplateRanking.js";

export type {
  VoiceCollectiveIntelligenceGovernor,
  VoiceAuthorityMode,
  VoiceKnowledgeHealth,
} from "./voiceCollectiveGovernor.js";

// ============================================================================
// Core imports
// ============================================================================

import {
  buildVoiceKnowledgeFederations,
  registerVoiceFederationRecord,
  getAllFederationRecords,
  type VoiceKnowledgeFederationRecord,
} from "./voiceKnowledgeFederation.js";

import {
  calculateCollectiveTemplateScore,
  rankTemplatesCollectively,
  getHighValueCoreTemplates,
  registerCollectiveTemplateScore,
} from "./voiceCollectiveTemplateRanking.js";

import type { VoiceMissionTemplate } from "./voiceMissionTemplateLibrary.js";
import { getAllVoiceMissionTemplates } from "./voiceMissionTemplateLibrary.js";

import type { VoiceCollectiveTemplateScore } from "./voiceCollectiveTemplateRanking.js";

import {
  evaluateCollectiveGovernor,
  approveForCore,
  setCurrentGovernor,
  type VoiceCollectiveIntelligenceGovernor,
  type VoiceGovernorApprovalResult,
} from "./voiceCollectiveGovernor.js";

import type { VoiceMissionKnowledge } from "./voiceMissionKnowledgeExtraction.js";

// ============================================================================
// Integration pipeline
// ============================================================================

/**
 * Full collective intelligence pipeline result.
 */
export interface VoiceCollectiveIntelligenceResult {
  // V8.8 — Federation
  federations: VoiceKnowledgeFederationRecord[];

  // V8.9 — Ranking
  rankedTemplates: {
    template: VoiceMissionTemplate;
    score: VoiceCollectiveTemplateScore;
  }[];
  highValueCore: {
    template: VoiceMissionTemplate;
    score: VoiceCollectiveTemplateScore;
  }[];

  // V9.0 — Governor
  governor: VoiceCollectiveIntelligenceGovernor;
  governorApprovals: Array<{
    templateId: string;
    result: VoiceGovernorApprovalResult;
  }>;

  // Summary
  summary: string;
}

/**
 * Execute the full collective intelligence pipeline.
 *
 * Pipeline flow:
 *   1. Build federations from mission knowledge (V8.8)
 *   2. Rank templates collectively (V8.9)
 *   3. Evaluate governor state (V9.0)
 *   4. Approve templates for core entry (V9.0)
 */
export function executeCollectiveIntelligencePipeline(
  knowledgeRecords: VoiceMissionKnowledge[],
): VoiceCollectiveIntelligenceResult {
  // ─── Step 1: Build federations (V8.8) ───
  const { federations } = buildVoiceKnowledgeFederations({
    knowledgeRecords,
    minPatternConfidence: 50,
  });

  for (const fed of federations) {
    registerVoiceFederationRecord(fed);
  }

  // ─── Step 2: Rank templates collectively (V8.9) ───
  const allTemplates = getAllVoiceMissionTemplates();
  const rankedTemplates = rankTemplatesCollectively(
    allTemplates,
    federations,
  );

  for (const { score } of rankedTemplates) {
    registerCollectiveTemplateScore(score);
  }

  const highValueCore = getHighValueCoreTemplates(rankedTemplates);

  // ─── Step 3: Evaluate governor (V9.0) ───
  const { governor } = evaluateCollectiveGovernor({
    federations,
    rankedTemplates,
    totalKnowledgeRecords: knowledgeRecords.length,
  });

  setCurrentGovernor(governor);

  // ─── Step 4: Approve templates for core (V9.0) ───
  const governorApprovals: Array<{
    templateId: string;
    result: VoiceGovernorApprovalResult;
  }> = [];

  for (const { template, score } of rankedTemplates) {
    const approval = approveForCore(
      {
        template,
        score,
        federationSupport: score.supportingFederations?.length,
      },
      governor,
    );
    governorApprovals.push({ templateId: template.templateId, result: approval });
  }

  // ─── Build summary ───
  const summary = buildPipelineSummary(
    federations,
    rankedTemplates,
    highValueCore,
    governor,
    governorApprovals,
  );

  return {
    federations,
    rankedTemplates,
    highValueCore,
    governor,
    governorApprovals,
    summary,
  };
}

// ============================================================================
// Summary builder
// ============================================================================

function buildPipelineSummary(
  federations: VoiceKnowledgeFederationRecord[],
  rankedTemplates: {
    template: VoiceMissionTemplate;
    score: VoiceCollectiveTemplateScore;
  }[],
  highValueCore: {
    template: VoiceMissionTemplate;
    score: VoiceCollectiveTemplateScore;
  }[],
  governor: VoiceCollectiveIntelligenceGovernor,
  approvals: Array<{
    templateId: string;
    result: VoiceGovernorApprovalResult;
  }>,
): string {
  const parts: string[] = [];

  parts.push(
    `Federations: ${federations.length} (${federations.filter((f) => f.portabilityScore >= 70).length} high-portability)`,
  );

  parts.push(
    `Templates ranked: ${rankedTemplates.length} (${highValueCore.length} high-value core)`,
  );

  parts.push(
    `Governor: mode=${governor.authorityMode}, health=${governor.globalKnowledgeHealth}`,
  );

  const approved = approvals.filter((a) => a.result.approved).length;
  parts.push(`Core approvals: ${approved}/${approvals.length}`);

  return parts.join(" | ");
}

// ============================================================================
// Formatter
// ============================================================================

export function formatCollectiveIntelligenceResult(
  result: VoiceCollectiveIntelligenceResult,
): string {
  const lines = [
    `═══════════════════════════════════════════════════════`,
    `🌐 Voice Collective Mission Intelligence — Result`,
    `═══════════════════════════════════════════════════════`,
    ``,
    result.summary,
    ``,
  ];

  if (result.federations.length > 0) {
    lines.push(`--- Knowledge Federations (${result.federations.length}) ---`);
    for (const fed of result.federations.slice(0, 3)) {
      lines.push(
        `  • ${fed.federationType}: portability=${fed.portabilityScore}%, ${fed.sharedPatterns.length} shared patterns`,
      );
    }
  }

  if (result.highValueCore.length > 0) {
    lines.push(`--- High-Value Core Templates ---`);
    for (const { template, score } of result.highValueCore.slice(0, 3)) {
      lines.push(
        `  • ${template.templateType}: rank=${score.overallRank}, stability=${score.dimensions.stabilityScore}%`,
      );
    }
  }

  if (result.governorApprovals.length > 0) {
    lines.push(`--- Governor Approvals ---`);
    for (const { templateId, result: approval } of result.governorApprovals.slice(0, 5)) {
      const status = approval.approved ? "✅" : "❌";
      lines.push(`  ${status} ${templateId.slice(0, 40)}...: ${approval.reason.slice(0, 60)}`);
    }
  }

  lines.push(``);
  lines.push(`═══════════════════════════════════════════════════════`);

  return lines.join("\n");
}
