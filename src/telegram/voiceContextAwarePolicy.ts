/**
 * Voice Context-Aware Policy & Behavior Adaptation Layer v7.4
 *
 * First-class entity: VoiceContextAwarePolicy
 *
 * This layer answers:
 *   - "How should policy behavior adapt to the current environment context?"
 *   - "What enforcement mode is appropriate for this context?"
 *   - "What are the policy adjustments for a given environment type?"
 *
 * This layer does NOT:
 *   - detect environment context (delegated to V7.3)
 *   - manage transitions between contexts (delegated to V7.5)
 *   - manage domain-level policies (delegated to V7.6)
 *
 * RULE: NO STATIC POLICY ACROSS DIFFERENT CONTEXTS
 */

import type {
  VoiceEnvironmentType,
  VoiceRiskLevel,
  VoiceAdaptationAllowance,
} from "./voiceEnvironmentContext.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceEnforcementMode = "soft" | "strict";

export interface VoiceContextAwarePolicy {
  policyId: string;

  environmentType: VoiceEnvironmentType;

  policyAdjustments: VoicePolicyAdjustments;

  enforcementMode: VoiceEnforcementMode;

  appliedAt: number;

  // Source context for traceability
  sourceContextId?: string;
}

export interface VoicePolicyAdjustments {
  /**
   * How aggressively the system should adapt (0 = no adaptation, 1 = maximum adaptation).
   */
  adaptationAggressiveness: number; // 0..1

  /**
   * How fast to roll out changes (0 = very slow, 1 = instant).
   */
  rolloutSpeed: number; // 0..1

  /**
   * How strict the review process should be (0 = lenient, 1 = maximum scrutiny).
   */
  reviewStrictness: number; // 0..1

  /**
   * How much risk the system is willing to tolerate (0 = zero tolerance, 1 = high tolerance).
   */
  riskTolerance: number; // 0..1

  /**
   * Minimum confidence required for automated decisions (0..100).
   */
  minDecisionConfidence: number; // 0..100

  /**
   * Maximum number of concurrent adaptations allowed.
   */
  maxConcurrentAdaptations: number;

  /**
   * Whether human review is required before applying changes.
   */
  requireHumanReview: boolean;

  /**
   * Cooldown period between adaptations (in milliseconds).
   */
  adaptationCooldownMs: number;
}

export type VoiceContextAwarePolicyValidationError =
  | "invalid_environment_type"
  | "adaptation_aggressiveness_out_of_range"
  | "rollout_speed_out_of_range"
  | "review_strictness_out_of_range"
  | "risk_tolerance_out_of_range"
  | "min_decision_confidence_out_of_range"
  | "max_concurrent_adaptations_invalid"
  | "adaptation_cooldown_invalid";

// ============================================================================
// ID generation
// ============================================================================

function generatePolicyId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(3);
  return `voice_policy_${timestamp}_${random}`;
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
// Default policy profiles per environment type
// ============================================================================

/**
 * Default policy adjustments for each environment type.
 * These form the baseline for context-aware policy generation.
 */
const DEFAULT_POLICY_PROFILES: Record<
  VoiceEnvironmentType,
  Omit<VoicePolicyAdjustments, "sourceContextId">
> = {
  crisis: {
    adaptationAggressiveness: 0,
    rolloutSpeed: 0,
    reviewStrictness: 1,
    riskTolerance: 0,
    minDecisionConfidence: 95,
    maxConcurrentAdaptations: 0,
    requireHumanReview: true,
    adaptationCooldownMs: 30 * 60 * 1000, // 30 minutes
  },

  stabilization: {
    adaptationAggressiveness: 0.1,
    rolloutSpeed: 0.1,
    reviewStrictness: 0.9,
    riskTolerance: 0.1,
    minDecisionConfidence: 85,
    maxConcurrentAdaptations: 1,
    requireHumanReview: true,
    adaptationCooldownMs: 15 * 60 * 1000, // 15 minutes
  },

  production: {
    adaptationAggressiveness: 0.3,
    rolloutSpeed: 0.3,
    reviewStrictness: 0.6,
    riskTolerance: 0.3,
    minDecisionConfidence: 75,
    maxConcurrentAdaptations: 3,
    requireHumanReview: false,
    adaptationCooldownMs: 5 * 60 * 1000, // 5 minutes
  },

  growth: {
    adaptationAggressiveness: 0.7,
    rolloutSpeed: 0.5,
    reviewStrictness: 0.4,
    riskTolerance: 0.6,
    minDecisionConfidence: 65,
    maxConcurrentAdaptations: 5,
    requireHumanReview: false,
    adaptationCooldownMs: 2 * 60 * 1000, // 2 minutes
  },

  testing: {
    adaptationAggressiveness: 1,
    rolloutSpeed: 1,
    reviewStrictness: 0.1,
    riskTolerance: 0.9,
    minDecisionConfidence: 50,
    maxConcurrentAdaptations: 10,
    requireHumanReview: false,
    adaptationCooldownMs: 0, // no cooldown in testing
  },
};

/**
 * Default enforcement mode per environment type.
 */
const DEFAULT_ENFORCEMENT_MODES: Record<
  VoiceEnvironmentType,
  VoiceEnforcementMode
> = {
  crisis: "strict",
  stabilization: "strict",
  production: "soft",
  growth: "soft",
  testing: "soft",
};

// ============================================================================
// Validation
// ============================================================================

export function validatePolicyAdjustments(
  adjustments: Partial<VoicePolicyAdjustments>,
): VoiceContextAwarePolicyValidationError[] {
  const errors: VoiceContextAwarePolicyValidationError[] = [];

  if (
    adjustments.adaptationAggressiveness !== undefined &&
    (adjustments.adaptationAggressiveness < 0 ||
      adjustments.adaptationAggressiveness > 1)
  ) {
    errors.push("adaptation_aggressiveness_out_of_range");
  }

  if (
    adjustments.rolloutSpeed !== undefined &&
    (adjustments.rolloutSpeed < 0 || adjustments.rolloutSpeed > 1)
  ) {
    errors.push("rollout_speed_out_of_range");
  }

  if (
    adjustments.reviewStrictness !== undefined &&
    (adjustments.reviewStrictness < 0 || adjustments.reviewStrictness > 1)
  ) {
    errors.push("review_strictness_out_of_range");
  }

  if (
    adjustments.riskTolerance !== undefined &&
    (adjustments.riskTolerance < 0 || adjustments.riskTolerance > 1)
  ) {
    errors.push("risk_tolerance_out_of_range");
  }

  if (
    adjustments.minDecisionConfidence !== undefined &&
    (adjustments.minDecisionConfidence < 0 ||
      adjustments.minDecisionConfidence > 100)
  ) {
    errors.push("min_decision_confidence_out_of_range");
  }

  if (
    adjustments.maxConcurrentAdaptations !== undefined &&
    adjustments.maxConcurrentAdaptations < 0
  ) {
    errors.push("max_concurrent_adaptations_invalid");
  }

  if (
    adjustments.adaptationCooldownMs !== undefined &&
    adjustments.adaptationCooldownMs < 0
  ) {
    errors.push("adaptation_cooldown_invalid");
  }

  return errors;
}

// ============================================================================
// Core policy generation
// ============================================================================

export interface VoiceContextAwarePolicyInput {
  environmentType: VoiceEnvironmentType;
  riskLevel?: VoiceRiskLevel;
  adaptationAllowance?: VoiceAdaptationAllowance;
  sourceContextId?: string;

  /** Override specific adjustments (otherwise use defaults). */
  customAdjustments?: Partial<VoicePolicyAdjustments>;
}

/**
 * Generate a context-aware policy based on the environment type.
 * Pure function — deterministic given the same input.
 */
export function generateVoiceContextAwarePolicy(
  input: VoiceContextAwarePolicyInput,
): VoiceContextAwarePolicy {
  const profile = DEFAULT_POLICY_PROFILES[input.environmentType];
  const enforcementMode =
    DEFAULT_ENFORCEMENT_MODES[input.environmentType];

  // Start with defaults
  let adjustments: VoicePolicyAdjustments = { ...profile };

  // Apply risk-level modifiers
  adjustments = applyRiskLevelModifiers(adjustments, input.riskLevel);

  // Apply adaptation allowance modifiers
  adjustments = applyAdaptationAllowanceModifiers(
    adjustments,
    input.adaptationAllowance,
  );

  // Apply custom overrides
  if (input.customAdjustments) {
    adjustments = { ...adjustments, ...input.customAdjustments };
  }

  const policy: VoiceContextAwarePolicy = {
    policyId: generatePolicyId(),
    environmentType: input.environmentType,
    policyAdjustments: adjustments,
    enforcementMode,
    appliedAt: Date.now(),
    sourceContextId: input.sourceContextId,
  };

  // Validate
  const errors = validatePolicyAdjustments(adjustments);
  if (errors.length > 0) {
    // Should never happen with correct derivation — fallback to crisis policy
    const crisisPolicy = DEFAULT_POLICY_PROFILES.crisis;
    policy.policyAdjustments = crisisPolicy;
    policy.enforcementMode = "strict";
  }

  return policy;
}

// ============================================================================
// Risk level modifiers
// ============================================================================

function applyRiskLevelModifiers(
  adjustments: VoicePolicyAdjustments,
  riskLevel?: VoiceRiskLevel,
): VoicePolicyAdjustments {
  if (!riskLevel) return adjustments;

  const modified = { ...adjustments };

  switch (riskLevel) {
    case "critical":
      // Lock down everything
      modified.adaptationAggressiveness = 0;
      modified.rolloutSpeed = 0;
      modified.reviewStrictness = 1;
      modified.riskTolerance = 0;
      modified.minDecisionConfidence = Math.max(
        modified.minDecisionConfidence,
        99,
      );
      modified.requireHumanReview = true;
      break;

    case "high":
      // Significantly restrict
      modified.adaptationAggressiveness = Math.min(
        modified.adaptationAggressiveness,
        0.2,
      );
      modified.rolloutSpeed = Math.min(modified.rolloutSpeed, 0.2);
      modified.reviewStrictness = Math.max(modified.reviewStrictness, 0.8);
      modified.riskTolerance = Math.min(modified.riskTolerance, 0.2);
      modified.minDecisionConfidence = Math.max(
        modified.minDecisionConfidence,
        90,
      );
      modified.requireHumanReview = true;
      break;

    case "medium":
      // Moderate restrictions — no change from baseline
      break;

    case "low":
      // Slightly relax
      modified.riskTolerance = Math.min(
        modified.riskTolerance + 0.1,
        1,
      );
      modified.minDecisionConfidence = Math.max(
        modified.minDecisionConfidence - 5,
        50,
      );
      break;
  }

  return modified;
}

// ============================================================================
// Adaptation allowance modifiers
// ============================================================================

function applyAdaptationAllowanceModifiers(
  adjustments: VoicePolicyAdjustments,
  allowance?: VoiceAdaptationAllowance,
): VoicePolicyAdjustments {
  if (!allowance) return adjustments;

  const modified = { ...adjustments };

  switch (allowance) {
    case "none":
      modified.adaptationAggressiveness = 0;
      modified.rolloutSpeed = 0;
      modified.maxConcurrentAdaptations = 0;
      break;

    case "minimal":
      modified.adaptationAggressiveness = Math.min(
        modified.adaptationAggressiveness,
        0.15,
      );
      modified.rolloutSpeed = Math.min(modified.rolloutSpeed, 0.15);
      modified.maxConcurrentAdaptations = Math.min(
        modified.maxConcurrentAdaptations,
        1,
      );
      break;

    case "restricted":
      // Use baseline — no additional modifiers
      break;

    case "full":
      // Max out adaptation capabilities
      modified.adaptationAggressiveness = Math.max(
        modified.adaptationAggressiveness,
        0.8,
      );
      modified.rolloutSpeed = Math.max(modified.rolloutSpeed, 0.8);
      modified.maxConcurrentAdaptations = Math.max(
        modified.maxConcurrentAdaptations,
        5,
      );
      break;
  }

  return modified;
}

// ============================================================================
// Policy registry
// ============================================================================

export interface VoiceContextAwarePolicyRegistry {
  active: VoiceContextAwarePolicy | null;
  history: VoiceContextAwarePolicy[];
  maxHistorySize: number;
}

const DEFAULT_POLICY_MAX_HISTORY = 50;

let _policyRegistry: VoiceContextAwarePolicyRegistry = {
  active: null,
  history: [],
  maxHistorySize: DEFAULT_POLICY_MAX_HISTORY,
};

export function getVoiceContextAwarePolicyRegistry(): VoiceContextAwarePolicyRegistry {
  return { ..._policyRegistry };
}

export function setActiveVoiceContextAwarePolicy(
  policy: VoiceContextAwarePolicy,
): void {
  const prev = _policyRegistry.active;
  _policyRegistry.active = policy;

  if (prev) {
    _policyRegistry.history.push(prev);
    if (_policyRegistry.history.length > _policyRegistry.maxHistorySize) {
      _policyRegistry.history = _policyRegistry.history.slice(
        -_policyRegistry.maxHistorySize,
      );
    }
  }
}

export function clearVoiceContextAwarePolicyRegistry(): void {
  _policyRegistry = {
    active: null,
    history: [],
    maxHistorySize: DEFAULT_POLICY_MAX_HISTORY,
  };
}

export function setVoiceContextAwarePolicyRegistryForTest(
  registry: VoiceContextAwarePolicyRegistry,
): void {
  _policyRegistry = registry;
}

// ============================================================================
// Policy comparison utility
// ============================================================================

export function compareVoicePolicies(
  a: VoiceContextAwarePolicy,
  b: VoiceContextAwarePolicy,
): string {
  const adjA = a.policyAdjustments;
  const adjB = b.policyAdjustments;

  const diffs: string[] = [];

  if (adjA.adaptationAggressiveness !== adjB.adaptationAggressiveness) {
    diffs.push(
      `adaptationAggressiveness: ${adjA.adaptationAggressiveness} → ${adjB.adaptationAggressiveness}`,
    );
  }
  if (adjA.rolloutSpeed !== adjB.rolloutSpeed) {
    diffs.push(
      `rolloutSpeed: ${adjA.rolloutSpeed} → ${adjB.rolloutSpeed}`,
    );
  }
  if (adjA.reviewStrictness !== adjB.reviewStrictness) {
    diffs.push(
      `reviewStrictness: ${adjA.reviewStrictness} → ${adjB.reviewStrictness}`,
    );
  }
  if (adjA.riskTolerance !== adjB.riskTolerance) {
    diffs.push(
      `riskTolerance: ${adjA.riskTolerance} → ${adjB.riskTolerance}`,
    );
  }
  if (adjA.minDecisionConfidence !== adjB.minDecisionConfidence) {
    diffs.push(
      `minDecisionConfidence: ${adjA.minDecisionConfidence} → ${adjB.minDecisionConfidence}`,
    );
  }
  if (adjA.maxConcurrentAdaptations !== adjB.maxConcurrentAdaptations) {
    diffs.push(
      `maxConcurrentAdaptations: ${adjA.maxConcurrentAdaptations} → ${adjB.maxConcurrentAdaptations}`,
    );
  }
  if (adjA.requireHumanReview !== adjB.requireHumanReview) {
    diffs.push(
      `requireHumanReview: ${adjA.requireHumanReview} → ${adjB.requireHumanReview}`,
    );
  }
  if (adjA.adaptationCooldownMs !== adjB.adaptationCooldownMs) {
    diffs.push(
      `adaptationCooldownMs: ${adjA.adaptationCooldownMs} → ${adjB.adaptationCooldownMs}`,
    );
  }
  if (a.enforcementMode !== b.enforcementMode) {
    diffs.push(`enforcementMode: ${a.enforcementMode} → ${b.enforcementMode}`);
  }

  if (diffs.length === 0) return "No policy differences";
  return diffs.join("\n");
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceContextAwarePolicy(
  policy: VoiceContextAwarePolicy,
): string {
  const adj = policy.policyAdjustments;
  return [
    `📋 Voice Context-Aware Policy`,
    `• policy ID: ${policy.policyId}`,
    `• environment: ${policy.environmentType}`,
    `• enforcement: ${policy.enforcementMode}`,
    `--- Adjustments ---`,
    `• adaptation aggressiveness: ${adj.adaptationAggressiveness}`,
    `• rollout speed: ${adj.rolloutSpeed}`,
    `• review strictness: ${adj.reviewStrictness}`,
    `• risk tolerance: ${adj.riskTolerance}`,
    `• min decision confidence: ${adj.minDecisionConfidence}%`,
    `• max concurrent adaptations: ${adj.maxConcurrentAdaptations}`,
    `• require human review: ${adj.requireHumanReview ? "YES" : "NO"}`,
    `• adaptation cooldown: ${formatDurationMs(adj.adaptationCooldownMs)}`,
    `• applied at: ${new Date(policy.appliedAt).toISOString()}`,
    policy.sourceContextId
      ? `• source context: ${policy.sourceContextId}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatDurationMs(ms: number): string {
  if (ms === 0) return "0ms";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}
