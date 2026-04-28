/**
 * Voice Cross-Mission Knowledge Federation Layer v8.8
 *
 * First-class entity: VoiceKnowledgeFederationRecord
 *
 * This layer answers:
 *   - "What patterns repeat across multiple missions?"
 *   - "Is this knowledge locally lucky or globally valid?"
 *   - "What is the portability score of this knowledge cluster?"
 *
 * This layer does NOT:
 *   - extract knowledge from single missions (delegated to V8.5)
 *   - rank templates ecosystem-wide (delegated to V8.9)
 *   - govern collective intelligence (delegated to V9.0)
 *
 * RULE: NO GLOBAL KNOWLEDGE CLAIM WITHOUT MULTI-MISSION SUPPORT
 */

import type {
  VoiceMissionKnowledge,
  VoiceKnowledgePatternType,
} from "./voiceMissionKnowledgeExtraction.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceFederationType =
  | "success_cluster"
  | "failure_cluster"
  | "risk_cluster"
  | "dependency_cluster";

export interface VoiceFederationSharedPattern {
  patternKey: string;
  confidence: number; // 0..100
  supportingMissions: number;
  sourceKnowledgeIds: string[];
}

export interface VoiceKnowledgeFederationRecord {
  federationId: string;

  sourceKnowledgeIds: string[];
  sourceMissionIds: string[];

  federationType: VoiceFederationType;

  sharedPatterns: VoiceFederationSharedPattern[];

  portabilityScore: number; // 0..100

  createdAt: number;

  // Metadata
  minConfidence: number;
  maxConfidence: number;
  avgConfidence: number;
}

export type VoiceFederationValidationError =
  | "no_source_missions"
  | "insufficient_mission_support"
  | "no_shared_patterns"
  | "portability_out_of_range"
  | "duplicate_knowledge_ids";

// ============================================================================
// ID generation
// ============================================================================

function generateFederationId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(3);
  return `voice_fed_${timestamp}_${random}`;
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

const MIN_MISSIONS_FOR_FEDERATION = 3;

export function validateFederationRecord(
  record: Partial<VoiceKnowledgeFederationRecord>,
): VoiceFederationValidationError[] {
  const errors: VoiceFederationValidationError[] = [];

  if (
    !record.sourceMissionIds ||
    record.sourceMissionIds.length === 0
  ) {
    errors.push("no_source_missions");
  }

  if (
    record.sourceMissionIds &&
    record.sourceMissionIds.length < MIN_MISSIONS_FOR_FEDERATION
  ) {
    errors.push("insufficient_mission_support");
  }

  if (
    record.sharedPatterns &&
    record.sharedPatterns.length === 0
  ) {
    errors.push("no_shared_patterns");
  }

  if (
    record.portabilityScore !== undefined &&
    (record.portabilityScore < 0 || record.portabilityScore > 100)
  ) {
    errors.push("portability_out_of_range");
  }

  // Check for duplicate knowledge IDs
  if (record.sourceKnowledgeIds) {
    const unique = new Set(record.sourceKnowledgeIds);
    if (unique.size !== record.sourceKnowledgeIds.length) {
      errors.push("duplicate_knowledge_ids");
    }
  }

  return errors;
}

// ============================================================================
// Federation building
// ============================================================================

export interface VoiceFederationBuildInput {
  knowledgeRecords: VoiceMissionKnowledge[];
  minPatternConfidence: number; // minimum confidence to include pattern
}

/**
 * Build federation records by clustering patterns across missions.
 * Pure function — analyzes knowledge records and finds shared patterns.
 */
export function buildVoiceKnowledgeFederations(
  input: VoiceFederationBuildInput,
): {
  federations: VoiceKnowledgeFederationRecord[];
  validationErrors: VoiceFederationValidationError[];
} {
  const federations: VoiceKnowledgeFederationRecord[] = [];
  const allErrors: VoiceFederationValidationError[] = [];

  // Cluster by federation type
  const successRecords = input.knowledgeRecords.filter(
    (k) => k.missionOutcome === "completed" && k.finalHealthScore >= 70,
  );
  const failureRecords = input.knowledgeRecords.filter(
    (k) =>
      k.missionOutcome === "aborted" ||
      k.missionOutcome === "failed" ||
      k.failedNodes > 0,
  );
  const riskRecords = input.knowledgeRecords.filter(
    (k) => k.recoveryTriggered || k.replanTriggered,
  );
  const dependencyRecords = input.knowledgeRecords.filter(
    (k) =>
      k.extractedPatterns.some((p) => p.type === "optimal_dependency"),
  );

  // Build federations for each type
  const successFed = buildFederationByType(
    successRecords,
    "success_cluster",
    input.minPatternConfidence,
  );
  if (successFed) {
    const errors = validateFederationRecord(successFed);
    if (errors.length === 0) federations.push(successFed);
    else allErrors.push(...errors);
  }

  const failureFed = buildFederationByType(
    failureRecords,
    "failure_cluster",
    input.minPatternConfidence,
  );
  if (failureFed) {
    const errors = validateFederationRecord(failureFed);
    if (errors.length === 0) federations.push(failureFed);
    else allErrors.push(...errors);
  }

  const riskFed = buildFederationByType(
    riskRecords,
    "risk_cluster",
    input.minPatternConfidence,
  );
  if (riskFed) {
    const errors = validateFederationRecord(riskFed);
    if (errors.length === 0) federations.push(riskFed);
    else allErrors.push(...errors);
  }

  const dependencyFed = buildFederationByType(
    dependencyRecords,
    "dependency_cluster",
    input.minPatternConfidence,
  );
  if (dependencyFed) {
    const errors = validateFederationRecord(dependencyFed);
    if (errors.length === 0) federations.push(dependencyFed);
    else allErrors.push(...errors);
  }

  return { federations, validationErrors: allErrors };
}

/**
 * Build a federation for a specific type of knowledge records.
 */
function buildFederationByType(
  records: VoiceMissionKnowledge[],
  type: VoiceFederationType,
  minConfidence: number,
): VoiceKnowledgeFederationRecord | null {
  if (records.length < MIN_MISSIONS_FOR_FEDERATION) return null;

  // Extract patterns from all records and find common ones
  const patternCounts = new Map<string, {
    count: number;
    totalConfidence: number;
    sourceKnowledgeIds: string[];
  }>();

  for (const record of records) {
    const relevantPatterns = record.extractedPatterns.filter(
      (p) => p.confidence >= minConfidence,
    );

    // Group patterns by normalized description (pattern key)
    const seenKeys = new Set<string>();
    for (const pattern of relevantPatterns) {
      const key = normalizePatternKey(pattern);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        const existing = patternCounts.get(key) || {
          count: 0,
          totalConfidence: 0,
          sourceKnowledgeIds: [],
        };
        existing.count++;
        existing.totalConfidence += pattern.confidence;
        existing.sourceKnowledgeIds.push(record.knowledgeId);
        patternCounts.set(key, existing);
      }
    }
  }

  // Build shared patterns (patterns that appear in 2+ missions)
  const sharedPatterns: VoiceFederationSharedPattern[] = [];
  for (const [key, data] of patternCounts) {
    if (data.count >= 2) {
      sharedPatterns.push({
        patternKey: key,
        confidence: Math.round(data.totalConfidence / data.count),
        supportingMissions: data.count,
        sourceKnowledgeIds: data.sourceKnowledgeIds,
      });
    }
  }

  if (sharedPatterns.length === 0) return null;

  // Calculate portability score
  const missionIds = [...new Set(records.map((r) => r.missionId))];
  const domainCoverage = new Set<string>();
  for (const record of records) {
    for (const domain of record.domainCoverage) {
      domainCoverage.add(domain);
    }
  }

  const portabilityScore = calculatePortabilityScore(
    sharedPatterns,
    missionIds.length,
    domainCoverage.size,
  );

  const confidences = sharedPatterns.map((p) => p.confidence);

  return {
    federationId: generateFederationId(),
    sourceKnowledgeIds: [...new Set(records.map((r) => r.knowledgeId))],
    sourceMissionIds: missionIds,
    federationType: type,
    sharedPatterns: sharedPatterns.sort(
      (a, b) => b.supportingMissions - a.supportingMissions,
    ),
    portabilityScore,
    createdAt: Date.now(),
    minConfidence: Math.min(...confidences),
    maxConfidence: Math.max(...confidences),
    avgConfidence: Math.round(
      confidences.reduce((s, v) => s + v, 0) / confidences.length,
    ),
  };
}

/**
 * Normalize a pattern to a key for comparison across missions.
 */
function normalizePatternKey(pattern: {
  type: string;
  description: string;
  contextConditions: string[];
}): string {
  // Extract the core pattern type and conditions, ignoring specific IDs
  const core = pattern.description
    .replace(/voice_[a-z0-9_]+/g, "__ID__")
    .replace(/node_[a-z0-9_]+/g, "__NODE__")
    .replace(/domain_\d+/g, "__DOMAIN__");

  return `${pattern.type}:${core}`;
}

/**
 * Calculate portability score based on pattern spread.
 */
function calculatePortabilityScore(
  sharedPatterns: VoiceFederationSharedPattern[],
  missionCount: number,
  domainCount: number,
): number {
  let score = 50; // baseline

  // Bonus: more missions supporting patterns
  score += Math.min(25, (missionCount - MIN_MISSIONS_FOR_FEDERATION) * 5);

  // Bonus: multi-domain coverage
  score += Math.min(15, domainCount * 3);

  // Bonus: high-confidence shared patterns
  const highConfPatterns = sharedPatterns.filter(
    (p) => p.confidence >= 70,
  ).length;
  score += Math.min(10, highConfPatterns * 3);

  return Math.round(Math.max(0, Math.min(100, score)));
}

// ============================================================================
// Federation registry
// ============================================================================

export interface VoiceFederationRegistry {
  federations: Map<string, VoiceKnowledgeFederationRecord>;
  maxFederations: number;
}

const DEFAULT_FEDERATION_MAX = 100;

let _federationRegistry: VoiceFederationRegistry = {
  federations: new Map(),
  maxFederations: DEFAULT_FEDERATION_MAX,
};

export function getVoiceFederationRegistry(): VoiceFederationRegistry {
  return {
    federations: new Map(_federationRegistry.federations),
    maxFederations: _federationRegistry.maxFederations,
  };
}

export function registerVoiceFederationRecord(
  record: VoiceKnowledgeFederationRecord,
): void {
  if (_federationRegistry.federations.size >= _federationRegistry.maxFederations) {
    throw new Error(
      `Federation registry full (max ${_federationRegistry.maxFederations}). Cannot register ${record.federationId}`,
    );
  }
  _federationRegistry.federations.set(record.federationId, record);
}

export function getVoiceFederationRecord(
  federationId: string,
): VoiceKnowledgeFederationRecord | undefined {
  return _federationRegistry.federations.get(federationId);
}

export function getAllFederationRecords(): VoiceKnowledgeFederationRecord[] {
  return Array.from(_federationRegistry.federations.values());
}

export function getFederationsByType(
  type: VoiceFederationType,
): VoiceKnowledgeFederationRecord[] {
  return Array.from(_federationRegistry.federations.values()).filter(
    (f) => f.federationType === type,
  );
}

export function getHighPortabilityFederations(
  minScore: number = 70,
): VoiceKnowledgeFederationRecord[] {
  return Array.from(_federationRegistry.federations.values()).filter(
    (f) => f.portabilityScore >= minScore,
  );
}

export function removeVoiceFederationRecord(federationId: string): boolean {
  return _federationRegistry.federations.delete(federationId);
}

export function clearVoiceFederationRegistry(): void {
  _federationRegistry = {
    federations: new Map(),
    maxFederations: DEFAULT_FEDERATION_MAX,
  };
}

export function setVoiceFederationRegistryForTest(
  registry: VoiceFederationRegistry,
): void {
  _federationRegistry = registry;
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceKnowledgeFederationRecord(
  record: VoiceKnowledgeFederationRecord,
): string {
  const typeEmoji: Record<VoiceFederationType, string> = {
    success_cluster: "✅",
    failure_cluster: "❌",
    risk_cluster: "⚠️",
    dependency_cluster: "🔗",
  };

  const lines = [
    `🌐 Voice Knowledge Federation`,
    `• federation ID: ${record.federationId}`,
    `• type: ${typeEmoji[record.federationType]} ${record.federationType}`,
    `• portability: ${record.portabilityScore}%`,
    `• missions: ${record.sourceMissionIds.length} (${record.sourceMissionIds.join(", ")})`,
    `• knowledge records: ${record.sourceKnowledgeIds.length}`,
    `• confidence: min=${record.minConfidence}%, max=${record.maxConfidence}%, avg=${record.avgConfidence}%`,
    `• created at: ${new Date(record.createdAt).toISOString()}`,
    `--- Shared Patterns (${record.sharedPatterns.length}) ---`,
  ];

  for (const pattern of record.sharedPatterns.slice(0, 5)) {
    lines.push(
      `  • ${pattern.patternKey.slice(0, 60)}... (${pattern.confidence}%, ${pattern.supportingMissions} missions)`,
    );
  }

  return lines.join("\n");
}
