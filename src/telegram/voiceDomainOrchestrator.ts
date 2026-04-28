/**
 * Voice Domain Governance Orchestrator & Global System Coherence Layer v7.8
 *
 * First-class entity: VoiceDomainOrchestrator
 *
 * This layer answers:
 *   - "What is the global state of all domains combined?"
 *   - "How coherent is the system behavior across domains?"
 *   - "What orchestration mode is appropriate for the current state?"
 *
 * This layer does NOT:
 *   - define domain boundaries (delegated to V7.6)
 *   - resolve individual consensus (delegated to V7.7)
 *   - manage missions (delegated to V7.9+)
 *
 * RULE: SYSTEM MUST MAINTAIN GLOBAL COHERENCE ACROSS DOMAINS
 */

import type {
  VoiceDomain,
  VoiceDomainType,
  VoiceDomainIsolationLevel,
  VoiceDomainRiskProfile,
} from "./voiceDomainSegmentation.js";
import type { VoiceDomainConsensus } from "./voiceDomainConsensus.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceGlobalState =
  | "stable"
  | "adaptive"
  | "constrained"
  | "critical";

export type VoiceOrchestrationMode =
  | "independent"
  | "coordinated"
  | "strict_control";

export interface VoiceDomainOrchestrator {
  orchestratorId: string;

  activeDomains: string[]; // domain IDs

  globalState: VoiceGlobalState;

  coherenceScore: number; // 0..100

  orchestrationMode: VoiceOrchestrationMode;

  lastEvaluatedAt: number;

  // Health aggregation
  domainHealthScores: Record<string, number>; // domainId -> healthScore

  // Conflict tracking
  activeConflicts: number;
  recentConsensusCount: number;

  // Metadata
  evaluationReason: string;
}

export type VoiceOrchestratorValidationError =
  | "no_active_domains"
  | "coherence_score_out_of_range"
  | "negative_active_conflicts"
  | "negative_recent_consensus";

// ============================================================================
// ID generation
// ============================================================================

function generateOrchestratorId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(3);
  return `voice_orch_${timestamp}_${random}`;
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

export function validateOrchestrator(
  orchestrator: Partial<VoiceDomainOrchestrator>,
): VoiceOrchestratorValidationError[] {
  const errors: VoiceOrchestratorValidationError[] = [];

  if (
    !orchestrator.activeDomains ||
    orchestrator.activeDomains.length === 0
  ) {
    errors.push("no_active_domains");
  }

  if (
    orchestrator.coherenceScore !== undefined &&
    (orchestrator.coherenceScore < 0 || orchestrator.coherenceScore > 100)
  ) {
    errors.push("coherence_score_out_of_range");
  }

  if (
    orchestrator.activeConflicts !== undefined &&
    orchestrator.activeConflicts < 0
  ) {
    errors.push("negative_active_conflicts");
  }

  if (
    orchestrator.recentConsensusCount !== undefined &&
    orchestrator.recentConsensusCount < 0
  ) {
    errors.push("negative_recent_consensus");
  }

  return errors;
}

// ============================================================================
// Global state determination
// ============================================================================

/**
 * Determine the global state based on domain health and conflicts.
 */
export function determineGlobalState(
  domainHealthScores: Record<string, number>,
  activeConflicts: number,
): VoiceGlobalState {
  const healthValues = Object.values(domainHealthScores);

  if (healthValues.length === 0) return "critical";

  const avgHealth =
    healthValues.reduce((sum, v) => sum + v, 0) / healthValues.length;
  const minHealth = Math.min(...healthValues);

  // Critical: any domain below 20% OR average below 40%
  if (minHealth < 20 || avgHealth < 40) return "critical";

  // Constrained: conflicts present OR average below 60%
  if (activeConflicts > 0 || avgHealth < 60) return "constrained";

  // Adaptive: average below 80% but no critical issues
  if (avgHealth < 80) return "adaptive";

  // Stable: everything healthy
  return "stable";
}

// ============================================================================
// Coherence scoring
// ============================================================================

/**
 * Calculate coherence score across domains.
 * Coherence measures how well-aligned domain behaviors are.
 */
export function calculateCoherenceScore(
  domains: VoiceDomain[],
  recentConsensus: VoiceDomainConsensus[],
): number {
  if (domains.length === 0) return 0;
  if (domains.length === 1) return 100;

  // Factor 1: Domain health variance (lower variance = higher coherence)
  const healthScores = domains.map((d) => d.healthScore);
  const avgHealth = healthScores.reduce((s, v) => s + v, 0) / healthScores.length;
  const healthVariance =
    healthScores.reduce((s, v) => s + Math.pow(v - avgHealth, 2), 0) /
    healthScores.length;
  const healthCoherence = Math.max(0, 100 - healthVariance / 10);

  // Factor 2: Isolation consistency
  const isolationConsistency = calculateIsolationConsistency(domains);

  // Factor 3: Consensus success rate
  const consensusSuccess = calculateConsensusSuccess(recentConsensus);

  // Weighted combination
  const coherence =
    healthCoherence * 0.5 + isolationConsistency * 0.25 + consensusSuccess * 0.25;

  return Math.round(Math.max(0, Math.min(100, coherence)));
}

function calculateIsolationConsistency(domains: VoiceDomain[]): number {
  const isolationWeights: Record<VoiceDomainIsolationLevel, number> = {
    strict: 3,
    moderate: 2,
    shared: 1,
  };

  const riskPenalties: Record<VoiceDomainRiskProfile, number> = {
    critical: 3,
    high: 2,
    medium: 1,
    low: 0,
  };

  let totalScore = 0;
  let expectedScore = 0;

  for (const domain of domains) {
    const actualIsolation = isolationWeights[domain.isolationLevel];
    const expectedIsolation = riskPenalties[domain.riskProfile];

    // Score is based on how well isolation matches risk
    const match = Math.abs(actualIsolation - expectedIsolation);
    totalScore += Math.max(0, 100 - match * 33);
    expectedScore += 100;
  }

  return expectedScore > 0 ? totalScore / expectedScore * 100 : 100;
}

function calculateConsensusSuccess(
  consensus: VoiceDomainConsensus[],
): number {
  if (consensus.length === 0) return 100; // No conflicts = perfect coherence

  const successful = consensus.filter(
    (c) =>
      c.resolution === "majority_vote" ||
      c.resolution === "priority_domain" ||
      c.resolution === "safety_override",
  ).length;

  // Human-required consensus counts as partial success (indicates disagreement)
  const humanRequired = consensus.filter(
    (c) => c.resolution === "require_human",
  ).length;

  return ((successful + humanRequired * 0.5) / consensus.length) * 100;
}

// ============================================================================
// Orchestration mode determination
// ============================================================================

/**
 * Determine orchestration mode based on global state and conflicts.
 */
export function determineOrchestrationMode(
  globalState: VoiceGlobalState,
  activeConflicts: number,
  coherenceScore: number,
): VoiceOrchestrationMode {
  // Critical state or high conflicts → strict control
  if (globalState === "critical" || activeConflicts > 5) {
    return "strict_control";
  }

  // Constrained or low coherence → coordinated
  if (globalState === "constrained" || coherenceScore < 60) {
    return "coordinated";
  }

  // Stable and high coherence → independent
  if (globalState === "stable" && coherenceScore >= 80) {
    return "independent";
  }

  // Default: coordinated
  return "coordinated";
}

// ============================================================================
// Orchestrator creation & evaluation
// ============================================================================

export interface VoiceOrchestratorInput {
  domains: VoiceDomain[];
  recentConsensus: VoiceDomainConsensus[];
  activeConflicts: number;
}

/**
 * Create or evaluate the domain orchestrator.
 * Pure function — computes global state, coherence, and mode.
 */
export function evaluateVoiceDomainOrchestrator(
  input: VoiceOrchestratorInput,
): VoiceDomainOrchestrator {
  const activeDomains = input.domains
    .filter((d) => d.enabled)
    .map((d) => d.domainId);

  const domainHealthScores: Record<string, number> = {};
  for (const domain of input.domains) {
    domainHealthScores[domain.domainId] = domain.healthScore;
  }

  const globalState = determineGlobalState(
    domainHealthScores,
    input.activeConflicts,
  );

  const coherenceScore = calculateCoherenceScore(
    input.domains,
    input.recentConsensus,
  );

  const orchestrationMode = determineOrchestrationMode(
    globalState,
    input.activeConflicts,
    coherenceScore,
  );

  const orchestrator: VoiceDomainOrchestrator = {
    orchestratorId: generateOrchestratorId(),
    activeDomains,
    globalState,
    coherenceScore,
    orchestrationMode,
    lastEvaluatedAt: Date.now(),
    domainHealthScores,
    activeConflicts: input.activeConflicts,
    recentConsensusCount: input.recentConsensus.length,
    evaluationReason: `globalState=${globalState}, coherence=${coherenceScore}%, conflicts=${input.activeConflicts}`,
  };

  const validationErrors = validateOrchestrator(orchestrator);
  if (validationErrors.length > 0) {
    // Should never happen with correct derivation — fallback to safe defaults
    orchestrator.globalState = "critical";
    orchestrator.coherenceScore = 0;
    orchestrator.orchestrationMode = "strict_control";
    orchestrator.evaluationReason += ` | Validation failed (${validationErrors.join(", ")}), fallback to safe defaults`;
  }

  return orchestrator;
}

// ============================================================================
// Orchestrator singleton
// ============================================================================

let _currentOrchestrator: VoiceDomainOrchestrator | null = null;

export function getCurrentOrchestrator(): VoiceDomainOrchestrator | null {
  return _currentOrchestrator ? { ..._currentOrchestrator } : null;
}

export function setCurrentOrchestrator(
  orchestrator: VoiceDomainOrchestrator,
): void {
  _currentOrchestrator = orchestrator;
}

export function clearCurrentOrchestrator(): void {
  _currentOrchestrator = null;
}

export function setOrchestratorForTest(
  orchestrator: VoiceDomainOrchestrator | null,
): void {
  _currentOrchestrator = orchestrator;
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceDomainOrchestrator(
  orchestrator: VoiceDomainOrchestrator,
): string {
  const stateEmoji: Record<VoiceGlobalState, string> = {
    stable: "🟢",
    adaptive: "🟡",
    constrained: "🟠",
    critical: "🔴",
  };

  const modeEmoji: Record<VoiceOrchestrationMode, string> = {
    independent: "🔓",
    coordinated: "🔗",
    strict_control: "🔒",
  };

  return [
    `🎛️ Voice Domain Orchestrator`,
    `• orchestrator ID: ${orchestrator.orchestratorId}`,
    `• global state: ${stateEmoji[orchestrator.globalState]} ${orchestrator.globalState}`,
    `• coherence score: ${orchestrator.coherenceScore}%`,
    `• orchestration mode: ${modeEmoji[orchestrator.orchestrationMode]} ${orchestrator.orchestrationMode}`,
    `• active domains: ${orchestrator.activeDomains.length} (${orchestrator.activeDomains.join(", ") || "none"})`,
    `• active conflicts: ${orchestrator.activeConflicts}`,
    `• recent consensus: ${orchestrator.recentConsensusCount}`,
    `• evaluation: ${orchestrator.evaluationReason}`,
    `• last evaluated: ${new Date(orchestrator.lastEvaluatedAt).toISOString()}`,
    `--- Domain Health ---`,
    ...Object.entries(orchestrator.domainHealthScores).map(
      ([id, score]) => `  • ${id}: ${score}%`,
    ),
  ].join("\n");
}
