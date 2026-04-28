/**
 * Voice Mission Knowledge Extraction & Patternization Layer v8.5
 *
 * First-class entity: VoiceMissionKnowledge
 *
 * This layer answers:
 *   - "What reusable knowledge can be extracted from a completed mission?"
 *   - "What patterns emerged — successful sequences, failure patterns, optimal dependencies?"
 *   - "How reusable is this knowledge across future missions?"
 *
 * This layer does NOT:
 *   - create templates (delegated to V8.6)
 *   - run feedback loops (delegated to V8.7)
 *   - extract knowledge mid-mission (only post-completion)
 *
 * RULE: NO MISSION COMPLETES WITHOUT KNOWLEDGE EXTRACTION
 */

import type { VoiceMissionGraphNode, VoiceMissionExecutionGraph } from "./voiceMissionExecutionGraph.js";
import type { VoiceGovernanceMission, VoiceMissionType, VoiceMissionStatus } from "./voiceMissionModel.js";
import type { VoiceMissionSupervisor, VoiceMissionRisk } from "./voiceMissionSupervision.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceKnowledgePatternType =
  | "successful_sequence"
  | "failure_pattern"
  | "optimal_dependency"
  | "risk_trigger";

export interface VoiceKnowledgePattern {
  type: VoiceKnowledgePatternType;

  description: string;

  confidence: number; // 0..100

  // Pattern metadata
  involvedNodeIds: string[];
  involvedDomainIds: string[];

  // Conditions under which this pattern holds
  contextConditions: string[];
}

export interface VoiceMissionKnowledge {
  knowledgeId: string;

  missionId: string;

  extractedPatterns: VoiceKnowledgePattern[];

  domainCoverage: string[];

  reusabilityScore: number; // 0..100

  createdAt: number;

  // Source metadata
  missionType: VoiceMissionType;
  missionOutcome: VoiceMissionStatus;
  finalHealthScore: number; // from supervisor
  totalNodes: number;
  completedNodes: number;
  failedNodes: number;
  recoveryTriggered: boolean;
  replanTriggered: boolean;

  // Knowledge quality
  extractionConfidence: number; // 0..100
  evidenceStrength: number; // 0..100
}

export type VoiceKnowledgeExtractionValidationError =
  | "invalid_mission_id"
  | "no_patterns_extracted"
  | "reusability_out_of_range"
  | "extraction_confidence_out_of_range"
  | "evidence_strength_out_of_range"
  | "missing_mission_type"
  | "missing_mission_outcome";

// ============================================================================
// ID generation
// ============================================================================

function generateKnowledgeId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(3);
  return `voice_knowledge_${timestamp}_${random}`;
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

export function validateMissionKnowledge(
  knowledge: Partial<VoiceMissionKnowledge>,
): VoiceKnowledgeExtractionValidationError[] {
  const errors: VoiceKnowledgeExtractionValidationError[] = [];

  if (!knowledge.missionId || knowledge.missionId.trim().length === 0) {
    errors.push("invalid_mission_id");
  }

  if (
    knowledge.extractedPatterns !== undefined &&
    knowledge.extractedPatterns.length === 0
  ) {
    errors.push("no_patterns_extracted");
  }

  if (
    knowledge.reusabilityScore !== undefined &&
    (knowledge.reusabilityScore < 0 || knowledge.reusabilityScore > 100)
  ) {
    errors.push("reusability_out_of_range");
  }

  if (
    knowledge.extractionConfidence !== undefined &&
    (knowledge.extractionConfidence < 0 || knowledge.extractionConfidence > 100)
  ) {
    errors.push("extraction_confidence_out_of_range");
  }

  if (
    knowledge.evidenceStrength !== undefined &&
    (knowledge.evidenceStrength < 0 || knowledge.evidenceStrength > 100)
  ) {
    errors.push("evidence_strength_out_of_range");
  }

  if (!knowledge.missionType) {
    errors.push("missing_mission_type");
  }

  if (!knowledge.missionOutcome) {
    errors.push("missing_mission_outcome");
  }

  return errors;
}

// ============================================================================
// Pattern extraction logic
// ============================================================================

export interface VoiceKnowledgeExtractionInput {
  mission: VoiceGovernanceMission;
  graph: VoiceMissionExecutionGraph;
  supervisor?: VoiceMissionSupervisor;
  recoveryTriggered: boolean;
  replanTriggered: boolean;
  detectedRisks?: VoiceMissionRisk[];
}

/**
 * Extract knowledge patterns from a completed mission.
 * Pure function — analyzes mission execution and extracts reusable patterns.
 */
export function extractMissionKnowledge(
  input: VoiceKnowledgeExtractionInput,
): {
  knowledge: VoiceMissionKnowledge;
  validationErrors: VoiceKnowledgeExtractionValidationError[];
} {
  const patterns: VoiceKnowledgePattern[] = [];

  // ─── Extract successful sequences ───
  const successfulSequences = extractSuccessfulSequences(
    input.graph.nodes,
  );
  patterns.push(...successfulSequences);

  // ─── Extract failure patterns ───
  const failurePatterns = extractFailurePatterns(
    input.graph.nodes,
    input.detectedRisks ?? [],
  );
  patterns.push(...failurePatterns);

  // ─── Extract optimal dependencies ───
  const optimalDeps = extractOptimalDependencies(input.graph.nodes);
  patterns.push(...optimalDeps);

  // ─── Extract risk triggers ───
  const riskTriggers = extractRiskTriggers(input.detectedRisks ?? []);
  patterns.push(...riskTriggers);

  // ─── Calculate domain coverage ───
  const domainCoverage = extractDomainCoverage(input.graph.nodes);

  // ─── Calculate reusability score ───
  const reusabilityScore = calculateReusabilityScore(
    patterns,
    input.mission,
    input.graph,
    input.supervisor,
  );

  // ─── Calculate extraction confidence ───
  const extractionConfidence = calculateExtractionConfidence(
    input.graph,
    input.supervisor,
  );

  // ─── Calculate evidence strength ───
  const evidenceStrength = calculateEvidenceStrength(
    input.graph,
    input.recoveryTriggered,
    input.replanTriggered,
  );

  const knowledge: VoiceMissionKnowledge = {
    knowledgeId: generateKnowledgeId(),
    missionId: input.mission.missionId,
    extractedPatterns: patterns,
    domainCoverage,
    reusabilityScore,
    createdAt: Date.now(),
    missionType: input.mission.missionType,
    missionOutcome: input.mission.missionStatus,
    finalHealthScore: input.supervisor?.missionHealthScore ?? 0,
    totalNodes: input.graph.nodes.length,
    completedNodes: input.graph.nodes.filter(
      (n) => n.status === "completed" || n.status === "skipped",
    ).length,
    failedNodes: input.graph.nodes.filter((n) => n.status === "failed").length,
    recoveryTriggered: input.recoveryTriggered,
    replanTriggered: input.replanTriggered,
    extractionConfidence,
    evidenceStrength,
  };

  const validationErrors = validateMissionKnowledge(knowledge);

  return { knowledge, validationErrors };
}

// ============================================================================
// Successful sequence extraction
// ============================================================================

function extractSuccessfulSequences(
  nodes: VoiceMissionGraphNode[],
): VoiceKnowledgePattern[] {
  const patterns: VoiceKnowledgePattern[] = [];

  // Find chains of completed nodes that form a dependency path
  const completedNodes = nodes.filter(
    (n) => n.status === "completed",
  );

  if (completedNodes.length < 2) return patterns;

  // Find the longest chain of dependent completed nodes
  const chains = findDependencyChains(completedNodes);

  for (const chain of chains) {
    if (chain.length >= 2) {
      const domainIds = [...new Set(chain.map((n) => n.domainId))];
      patterns.push({
        type: "successful_sequence",
        description: `Successful execution chain: ${chain.map((n) => `${n.actionType}@${n.domainId}`).join(" → ")}`,
        confidence: Math.min(95, 50 + chain.length * 10),
        involvedNodeIds: chain.map((n) => n.nodeId),
        involvedDomainIds: domainIds,
        contextConditions: [`all_${chain.length}_nodes_completed`],
      });
    }
  }

  return patterns;
}

function findDependencyChains(
  nodes: VoiceMissionGraphNode[],
): VoiceMissionGraphNode[][] {
  const chains: VoiceMissionGraphNode[][] = [];
  const visited = new Set<string>();

  // Start from nodes with no dependencies
  const roots = nodes.filter((n) => n.dependsOn.length === 0);

  for (const root of roots) {
    const chain = buildChain(root, nodes, new Set());
    if (chain.length > 1) {
      chains.push(chain);
    }
  }

  return chains;
}

function buildChain(
  node: VoiceMissionGraphNode,
  allNodes: VoiceMissionGraphNode[],
  visited: Set<string>,
): VoiceMissionGraphNode[] {
  if (visited.has(node.nodeId)) return [];
  visited.add(node.nodeId);

  // Find nodes that depend on this node
  const dependents = allNodes.filter((n) =>
    n.dependsOn.includes(node.nodeId) && !visited.has(n.nodeId),
  );

  if (dependents.length === 0) return [node];

  // Pick the longest continuation
  let longestContinuation: VoiceMissionGraphNode[] = [];
  for (const dep of dependents) {
    const continuation = buildChain(dep, allNodes, visited);
    if (continuation.length > longestContinuation.length) {
      longestContinuation = continuation;
    }
  }

  return [node, ...longestContinuation];
}

// ============================================================================
// Failure pattern extraction
// ============================================================================

function extractFailurePatterns(
  nodes: VoiceMissionGraphNode[],
  risks: VoiceMissionRisk[],
): VoiceKnowledgePattern[] {
  const patterns: VoiceKnowledgePattern[] = [];

  const failedNodes = nodes.filter((n) => n.status === "failed");

  for (const failedNode of failedNodes) {
    const affectedDependents = nodes.filter((n) =>
      n.dependsOn.includes(failedNode.nodeId) &&
      (n.status === "skipped" || n.status === "failed"),
    );

    patterns.push({
      type: "failure_pattern",
      description: `Failure at ${failedNode.actionType}@${failedNode.domainId}: ${failedNode.failureReason ?? "unknown"} (cascade: ${affectedDependents.length} nodes)`,
      confidence: Math.min(90, 60 + affectedDependents.length * 10),
      involvedNodeIds: [failedNode.nodeId, ...affectedDependents.map((n) => n.nodeId)],
      involvedDomainIds: [failedNode.domainId],
      contextConditions: [`${failedNode.actionType}_at_${failedNode.domainId}_unstable`],
    });
  }

  // Extract risk-based failure patterns
  for (const risk of risks.filter((r) => r.severity >= 60)) {
    patterns.push({
      type: "failure_pattern",
      description: `Risk trigger: ${risk.type} (severity=${risk.severity}) — ${risk.description}`,
      confidence: risk.severity,
      involvedNodeIds: risk.affectedNodeIds ?? [],
      involvedDomainIds: [],
      contextConditions: [`${risk.type}_above_threshold`],
    });
  }

  return patterns;
}

// ============================================================================
// Optimal dependency extraction
// ============================================================================

function extractOptimalDependencies(
  nodes: VoiceMissionGraphNode[],
): VoiceKnowledgePattern[] {
  const patterns: VoiceKnowledgePattern[] = [];

  const completedNodes = nodes.filter((n) => n.status === "completed");

  if (completedNodes.length < 2) return patterns;

  // Find critical path nodes (nodes that many others depend on)
  const dependencyCounts = new Map<string, number>();
  for (const node of completedNodes) {
    for (const depId of node.dependsOn) {
      dependencyCounts.set(depId, (dependencyCounts.get(depId) ?? 0) + 1);
    }
  }

  for (const [nodeId, count] of dependencyCounts) {
    if (count >= 2) {
      const node = completedNodes.find((n) => n.nodeId === nodeId);
      if (node) {
        patterns.push({
          type: "optimal_dependency",
          description: `Critical dependency: ${node.actionType}@${node.domainId} (${count} nodes depend on it)`,
          confidence: Math.min(95, 50 + count * 10),
          involvedNodeIds: [nodeId],
          involvedDomainIds: [node.domainId],
          contextConditions: [`high_dependency_count=${count}`],
        });
      }
    }
  }

  return patterns;
}

// ============================================================================
// Risk trigger extraction
// ============================================================================

function extractRiskTriggers(
  risks: VoiceMissionRisk[],
): VoiceKnowledgePattern[] {
  const patterns: VoiceKnowledgePattern[] = [];

  for (const risk of risks) {
    patterns.push({
      type: "risk_trigger",
      description: `Risk trigger: ${risk.type} (severity=${risk.severity}) — ${risk.description}`,
      confidence: Math.min(90, risk.severity),
      involvedNodeIds: risk.affectedNodeIds ?? [],
      involvedDomainIds: [],
      contextConditions: [`${risk.type}_detected`],
    });
  }

  return patterns;
}

// ============================================================================
// Domain coverage extraction
// ============================================================================

function extractDomainCoverage(
  nodes: VoiceMissionGraphNode[],
): string[] {
  return [...new Set(nodes.map((n) => n.domainId))];
}

// ============================================================================
// Reusability score calculation
// ============================================================================

function calculateReusabilityScore(
  patterns: VoiceKnowledgePattern[],
  mission: VoiceGovernanceMission,
  graph: VoiceMissionExecutionGraph,
  supervisor?: VoiceMissionSupervisor,
): number {
  let score = 50; // baseline

  // Bonus: successful mission
  if (mission.missionStatus === "completed") {
    score += 15;
  }

  // Bonus: high health score
  if (supervisor && supervisor.missionHealthScore > 70) {
    score += 10;
  }

  // Bonus: multiple patterns extracted
  score += Math.min(15, patterns.length * 3);

  // Bonus: multi-domain coverage
  const domainCount = extractDomainCoverage(graph.nodes).length;
  if (domainCount > 1) {
    score += Math.min(10, domainCount * 3);
  }

  // Penalty: recovery or replan triggered
  // (indicates the mission wasn't clean enough for easy reuse)
  // But we still extract knowledge — just lower reusability

  return Math.round(Math.max(0, Math.min(100, score)));
}

// ============================================================================
// Extraction confidence calculation
// ============================================================================

function calculateExtractionConfidence(
  graph: VoiceMissionExecutionGraph,
  supervisor?: VoiceMissionSupervisor,
): number {
  let confidence = 60; // baseline

  // More completed nodes = higher confidence
  const totalNodes = graph.nodes.length;
  const completedNodes = graph.nodes.filter(
    (n) => n.status === "completed" || n.status === "skipped",
  ).length;

  if (totalNodes > 0) {
    const completionRate = completedNodes / totalNodes;
    confidence += completionRate * 20;
  }

  // Supervisor health correlation
  if (supervisor && supervisor.missionHealthScore > 60) {
    confidence += 10;
  }

  return Math.round(Math.max(0, Math.min(100, confidence)));
}

// ============================================================================
// Evidence strength calculation
// ============================================================================

function calculateEvidenceStrength(
  graph: VoiceMissionExecutionGraph,
  recoveryTriggered: boolean,
  replanTriggered: boolean,
): number {
  let strength = 50; // baseline

  // More nodes = more evidence
  strength += Math.min(20, graph.nodes.length * 3);

  // Recovery/replan add evidence (shows the system had to adapt)
  if (recoveryTriggered) strength += 10;
  if (replanTriggered) strength += 10;

  // Failed nodes add evidence about what doesn't work
  const failedNodes = graph.nodes.filter((n) => n.status === "failed").length;
  strength += Math.min(15, failedNodes * 5);

  return Math.round(Math.max(0, Math.min(100, strength)));
}

// ============================================================================
// Knowledge registry
// ============================================================================

export interface VoiceMissionKnowledgeRegistry {
  knowledge: Map<string, VoiceMissionKnowledge>;
  maxKnowledge: number;
}

const DEFAULT_KNOWLEDGE_MAX = 500;

let _knowledgeRegistry: VoiceMissionKnowledgeRegistry = {
  knowledge: new Map(),
  maxKnowledge: DEFAULT_KNOWLEDGE_MAX,
};

export function getVoiceMissionKnowledgeRegistry(): VoiceMissionKnowledgeRegistry {
  return {
    knowledge: new Map(_knowledgeRegistry.knowledge),
    maxKnowledge: _knowledgeRegistry.maxKnowledge,
  };
}

export function registerVoiceMissionKnowledge(
  knowledge: VoiceMissionKnowledge,
): void {
  if (_knowledgeRegistry.knowledge.size >= _knowledgeRegistry.maxKnowledge) {
    throw new Error(
      `Knowledge registry full (max ${_knowledgeRegistry.maxKnowledge}). Cannot register ${knowledge.knowledgeId}`,
    );
  }
  _knowledgeRegistry.knowledge.set(knowledge.knowledgeId, knowledge);
}

export function getVoiceMissionKnowledge(
  knowledgeId: string,
): VoiceMissionKnowledge | undefined {
  return _knowledgeRegistry.knowledge.get(knowledgeId);
}

export function getKnowledgeForMission(
  missionId: string,
): VoiceMissionKnowledge[] {
  return Array.from(_knowledgeRegistry.knowledge.values()).filter(
    (k) => k.missionId === missionId,
  );
}

export function getAllVoiceMissionKnowledge(): VoiceMissionKnowledge[] {
  return Array.from(_knowledgeRegistry.knowledge.values());
}

export function getKnowledgeByPatternType(
  type: VoiceKnowledgePatternType,
): VoiceMissionKnowledge[] {
  return Array.from(_knowledgeRegistry.knowledge.values()).filter(
    (k) => k.extractedPatterns.some((p) => p.type === type),
  );
}

export function getHighReusabilityKnowledge(
  minScore: number = 70,
): VoiceMissionKnowledge[] {
  return Array.from(_knowledgeRegistry.knowledge.values()).filter(
    (k) => k.reusabilityScore >= minScore,
  );
}

export function removeVoiceMissionKnowledge(knowledgeId: string): boolean {
  return _knowledgeRegistry.knowledge.delete(knowledgeId);
}

export function clearVoiceMissionKnowledgeRegistry(): void {
  _knowledgeRegistry = {
    knowledge: new Map(),
    maxKnowledge: DEFAULT_KNOWLEDGE_MAX,
  };
}

export function setVoiceMissionKnowledgeRegistryForTest(
  registry: VoiceMissionKnowledgeRegistry,
): void {
  _knowledgeRegistry = registry;
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceMissionKnowledge(
  knowledge: VoiceMissionKnowledge,
): string {
  const typeEmoji: Record<VoiceKnowledgePatternType, string> = {
    successful_sequence: "✅",
    failure_pattern: "❌",
    optimal_dependency: "🔗",
    risk_trigger: "⚠️",
  };

  const outcomeEmoji: Record<string, string> = {
    completed: "✅",
    aborted: "❌",
    blocked: "🚫",
    planned: "📋",
    active: "🚀",
  };

  const lines = [
    `🧠 Voice Mission Knowledge`,
    `• knowledge ID: ${knowledge.knowledgeId}`,
    `• mission ID: ${knowledge.missionId}`,
    `• mission type: ${knowledge.missionType}`,
    `• mission outcome: ${outcomeEmoji[knowledge.missionOutcome] ?? "?"} ${knowledge.missionOutcome}`,
    `• reusability: ${knowledge.reusabilityScore}%`,
    `• extraction confidence: ${knowledge.extractionConfidence}%`,
    `• evidence strength: ${knowledge.evidenceStrength}%`,
    `• domain coverage: ${knowledge.domainCoverage.length} domains`,
    `• nodes: ${knowledge.completedNodes}/${knowledge.totalNodes} completed, ${knowledge.failedNodes} failed`,
    `• recovery triggered: ${knowledge.recoveryTriggered ? "YES" : "NO"}`,
    `• replan triggered: ${knowledge.replanTriggered ? "YES" : "NO"}`,
    `• created at: ${new Date(knowledge.createdAt).toISOString()}`,
    `--- Extracted Patterns (${knowledge.extractedPatterns.length}) ---`,
  ];

  for (const pattern of knowledge.extractedPatterns) {
    lines.push(
      `  ${typeEmoji[pattern.type]} ${pattern.type} (${pattern.confidence}%): ${pattern.description}`,
    );
  }

  return lines.join("\n");
}
