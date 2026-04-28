/**
 * Voice Environment Context Model Layer v7.3
 *
 * First-class entity: VoiceEnvironmentContext
 *
 * This layer answers:
 *   - "In what mode of the world is the system currently operating?"
 *   - "What is the current system load, risk level, and adaptation allowance?"
 *   - "How should the system classify its operational environment?"
 *
 * This layer does NOT:
 *   - change policy behavior (delegated to V7.4)
 *   - trigger transitions (delegated to V7.5)
 *   - manage domains (delegated to V7.6)
 *
 * It ONLY detects and models the current environment context.
 */

// ============================================================================
// Domain model
// ============================================================================

export type VoiceEnvironmentType =
  | "production"
  | "testing"
  | "growth"
  | "stabilization"
  | "crisis";

export type VoiceSystemLoad =
  | "low"
  | "medium"
  | "high";

export type VoiceRiskLevel =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type VoiceAdaptationAllowance =
  | "full"
  | "restricted"
  | "minimal"
  | "none";

export interface VoiceEnvironmentContext {
  contextId: string;

  environmentType: VoiceEnvironmentType;

  systemLoad: VoiceSystemLoad;

  riskLevel: VoiceRiskLevel;

  adaptationAllowance: VoiceAdaptationAllowance;

  detectedAt: number;

  // Supporting metadata for explainability
  indicators: VoiceEnvironmentIndicator[];

  confidence: number; // 0..100
}

export type VoiceEnvironmentIndicator =
  | "high_instability"
  | "frequent_rollbacks"
  | "stable_long_period"
  | "positive_growth_signals"
  | "high_error_rate"
  | "degraded_performance"
  | "test_markers_present"
  | "staging_environment"
  | "low_traffic"
  | "load_spike_detected"
  | "recovery_in_progress";

export type VoiceEnvironmentValidationError =
  | "invalid_environment_type"
  | "invalid_system_load"
  | "invalid_risk_level"
  | "invalid_adaptation_allowance"
  | "confidence_out_of_range"
  | "missing_indicators";

// ============================================================================
// ID generation
// ============================================================================

function generateContextId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(3);
  return `voice_env_ctx_${timestamp}_${random}`;
}

function cryptoRandomHex(bytes: number): string {
  // Node.js crypto fallback-safe for deterministic test environments
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

const VALID_ENVIRONMENT_TYPES: VoiceEnvironmentType[] = [
  "production",
  "testing",
  "growth",
  "stabilization",
  "crisis",
];

const VALID_SYSTEM_LOADS: VoiceSystemLoad[] = ["low", "medium", "high"];

const VALID_RISK_LEVELS: VoiceRiskLevel[] = [
  "low",
  "medium",
  "high",
  "critical",
];

const VALID_ADAPTATION_ALLOWANCES: VoiceAdaptationAllowance[] = [
  "full",
  "restricted",
  "minimal",
  "none",
];

export function validateEnvironmentContext(
  ctx: Partial<VoiceEnvironmentContext>,
): VoiceEnvironmentValidationError[] {
  const errors: VoiceEnvironmentValidationError[] = [];

  if (
    ctx.environmentType &&
    !VALID_ENVIRONMENT_TYPES.includes(ctx.environmentType)
  ) {
    errors.push("invalid_environment_type");
  }

  if (ctx.systemLoad && !VALID_SYSTEM_LOADS.includes(ctx.systemLoad)) {
    errors.push("invalid_system_load");
  }

  if (ctx.riskLevel && !VALID_RISK_LEVELS.includes(ctx.riskLevel)) {
    errors.push("invalid_risk_level");
  }

  if (
    ctx.adaptationAllowance &&
    !VALID_ADAPTATION_ALLOWANCES.includes(ctx.adaptationAllowance)
  ) {
    errors.push("invalid_adaptation_allowance");
  }

  if (ctx.confidence !== undefined && (ctx.confidence < 0 || ctx.confidence > 100)) {
    errors.push("confidence_out_of_range");
  }

  if (!ctx.indicators || ctx.indicators.length === 0) {
    errors.push("missing_indicators");
  }

  return errors;
}

// ============================================================================
// Detection logic — environment classifier
// ============================================================================

export interface VoiceEnvironmentDetectionInput {
  // Instability metrics
  instabilityScore: number; // 0..100
  rollbackFrequency: number; // rollbacks per hour

  // Stability metrics
  stabilityDurationHours: number; // hours of stable operation
  positiveSignalRate: number; // 0..100

  // Performance metrics
  errorRate: number; // 0..100
  avgLatencyMs: number;
  loadPercentage: number; // 0..100

  // Environment markers
  isTestEnvironment: boolean;
  isStaging: boolean;

  // Recovery markers
  recoveryInProgress: boolean;
}

export interface VoiceEnvironmentDetectionResult {
  context: VoiceEnvironmentContext;
  detectionReason: string;
  alternativeEnvironments: VoiceEnvironmentType[];
}

/**
 * Classify the current environment based on detection input.
 * Pure function — deterministic given the same input.
 *
 * Detection priority (highest to lowest):
 *   1. crisis (high instability + frequent rollbacks)
 *   2. testing (test markers present)
 *   3. stabilization (recovery in progress)
 *   4. growth (stable + positive signals)
 *   5. production (default healthy state)
 */
export function detectVoiceEnvironment(
  input: VoiceEnvironmentDetectionInput,
): VoiceEnvironmentDetectionResult {
  const indicators: VoiceEnvironmentIndicator[] = [];
  let environmentType: VoiceEnvironmentType;
  let detectionReason: string;
  let confidence: number;

  // --- CRISIS detection ---
  if (input.instabilityScore > 70 && input.rollbackFrequency > 3) {
    environmentType = "crisis";
    indicators.push("high_instability", "frequent_rollbacks");
    if (input.errorRate > 30) indicators.push("high_error_rate");
    if (input.recoveryInProgress) indicators.push("recovery_in_progress");
    detectionReason = `Crisis detected: instability=${input.instabilityScore}, rollbacks/hr=${input.rollbackFrequency}`;
    confidence = Math.min(95, 60 + (input.instabilityScore - 70) / 3 + (input.rollbackFrequency - 3) * 5);
  }
  // --- TESTING detection ---
  else if (input.isTestEnvironment || input.isStaging) {
    environmentType = "testing";
    indicators.push("test_markers_present");
    if (input.isStaging) indicators.push("staging_environment");
    detectionReason = `Testing environment detected: isTest=${input.isTestEnvironment}, isStaging=${input.isStaging}`;
    confidence = 100;
  }
  // --- STABILIZATION detection ---
  else if (input.recoveryInProgress || input.errorRate > 15) {
    environmentType = "stabilization";
    indicators.push("recovery_in_progress");
    if (input.errorRate > 15) indicators.push("high_error_rate");
    detectionReason = `Stabilization mode: recovery=${input.recoveryInProgress}, errorRate=${input.errorRate}`;
    confidence = Math.min(90, 50 + input.errorRate + (input.recoveryInProgress ? 20 : 0));
  }
  // --- GROWTH detection ---
  else if (
    input.stabilityDurationHours > 24 &&
    input.positiveSignalRate > 70
  ) {
    environmentType = "growth";
    indicators.push("stable_long_period", "positive_growth_signals");
    if (input.loadPercentage < 50) indicators.push("low_traffic");
    detectionReason = `Growth phase: stability=${input.stabilityDurationHours}h, positive=${input.positiveSignalRate}%`;
    confidence = Math.min(90, 50 + (input.stabilityDurationHours - 24) / 2 + (input.positiveSignalRate - 70) / 2);
  }
  // --- PRODUCTION (default) ---
  else {
    environmentType = "production";
    if (input.loadPercentage < 30) indicators.push("low_traffic");
    if (input.stabilityDurationHours > 12) indicators.push("stable_long_period");
    detectionReason = `Production mode: stability=${input.stabilityDurationHours}h, load=${input.loadPercentage}%`;
    confidence = Math.min(85, 50 + input.stabilityDurationHours / 2);
  }

  // --- Derive system load ---
  const systemLoad = deriveSystemLoad(input.loadPercentage, input.avgLatencyMs);

  // --- Derive risk level ---
  const riskLevel = deriveRiskLevel(
    environmentType,
    input.instabilityScore,
    input.errorRate,
    input.rollbackFrequency,
  );

  // --- Derive adaptation allowance ---
  const adaptationAllowance = deriveAdaptationAllowance(
    environmentType,
    riskLevel,
    systemLoad,
  );

  const context: VoiceEnvironmentContext = {
    contextId: generateContextId(),
    environmentType,
    systemLoad,
    riskLevel,
    adaptationAllowance,
    detectedAt: Date.now(),
    indicators,
    confidence: Math.round(confidence),
  };

  const validationErrors = validateEnvironmentContext(context);
  if (validationErrors.length > 0) {
    // Should never happen with correct derivation — fallback to safe defaults
    context.environmentType = "production";
    context.systemLoad = "medium";
    context.riskLevel = "medium";
    context.adaptationAllowance = "restricted";
    context.confidence = 50;
    detectionReason += ` | Validation failed (${validationErrors.join(", ")}), fallback to safe defaults`;
  }

  // Determine alternative environments for explainability
  const alternativeEnvironments = deriveAlternativeEnvironments(
    environmentType,
    input,
  );

  return {
    context,
    detectionReason,
    alternativeEnvironments,
  };
}

// ============================================================================
// Derivation helpers
// ============================================================================

function deriveSystemLoad(
  loadPercentage: number,
  avgLatencyMs: number,
): VoiceSystemLoad {
  // Load is high if either CPU/load percentage is high OR latency is very high
  if (loadPercentage > 75 || avgLatencyMs > 5000) return "high";
  if (loadPercentage > 40 || avgLatencyMs > 2000) return "medium";
  return "low";
}

function deriveRiskLevel(
  environmentType: VoiceEnvironmentType,
  instabilityScore: number,
  errorRate: number,
  rollbackFrequency: number,
): VoiceRiskLevel {
  let riskScore = 0;

  // Environment-based risk
  switch (environmentType) {
    case "crisis":
      riskScore += 50;
      break;
    case "stabilization":
      riskScore += 30;
      break;
    case "testing":
      riskScore += 10;
      break;
    case "growth":
      riskScore += 20;
      break;
    case "production":
      riskScore += 5;
      break;
  }

  // Metric-based risk
  riskScore += instabilityScore / 4;
  riskScore += errorRate / 2;
  riskScore += rollbackFrequency * 5;

  if (riskScore >= 70) return "critical";
  if (riskScore >= 40) return "high";
  if (riskScore >= 20) return "medium";
  return "low";
}

function deriveAdaptationAllowance(
  environmentType: VoiceEnvironmentType,
  riskLevel: VoiceRiskLevel,
  systemLoad: VoiceSystemLoad,
): VoiceAdaptationAllowance {
  // Crisis = no adaptation allowed
  if (environmentType === "crisis" || riskLevel === "critical") return "none";

  // High risk + high load = minimal adaptation
  if (riskLevel === "high" && systemLoad === "high") return "minimal";

  // Testing = full adaptation (safe to experiment)
  if (environmentType === "testing") return "full";

  // Growth = restricted (cautious experimentation)
  if (environmentType === "growth") return "restricted";

  // Stabilization = minimal (focused on recovery)
  if (environmentType === "stabilization") return "minimal";

  // Production default = restricted
  return "restricted";
}

function deriveAlternativeEnvironments(
  primary: VoiceEnvironmentType,
  input: VoiceEnvironmentDetectionInput,
): VoiceEnvironmentType[] {
  const alternatives: VoiceEnvironmentType[] = [];

  // If close to crisis thresholds, stabilization is an alternative
  if (primary !== "crisis" && input.instabilityScore > 50) {
    alternatives.push("stabilization");
  }

  // If stable but not yet growth, production is an alternative
  if (primary !== "production" && input.stabilityDurationHours > 12) {
    alternatives.push("production");
  }

  // If in crisis but recovery started, stabilization is next
  if (primary === "crisis" && input.recoveryInProgress) {
    alternatives.push("stabilization");
  }

  return alternatives;
}

// ============================================================================
// Context registry — tracks context history
// ============================================================================

export interface VoiceEnvironmentContextRegistry {
  current: VoiceEnvironmentContext | null;
  history: VoiceEnvironmentContext[];
  maxHistorySize: number;
}

const DEFAULT_MAX_HISTORY = 100;

let _registry: VoiceEnvironmentContextRegistry = {
  current: null,
  history: [],
  maxHistorySize: DEFAULT_MAX_HISTORY,
};

export function getVoiceEnvironmentContextRegistry(): VoiceEnvironmentContextRegistry {
  return { ..._registry };
}

export function setCurrentEnvironmentContext(
  ctx: VoiceEnvironmentContext,
): void {
  const prev = _registry.current;
  _registry.current = ctx;

  if (prev) {
    _registry.history.push(prev);
    // Trim history to max size
    if (_registry.history.length > _registry.maxHistorySize) {
      _registry.history = _registry.history.slice(-_registry.maxHistorySize);
    }
  }
}

export function clearVoiceEnvironmentContextRegistry(): void {
  _registry = {
    current: null,
    history: [],
    maxHistorySize: DEFAULT_MAX_HISTORY,
  };
}

export function setVoiceEnvironmentContextRegistryForTest(
  registry: VoiceEnvironmentContextRegistry,
): void {
  _registry = registry;
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceEnvironmentContext(
  ctx: VoiceEnvironmentContext,
): string {
  return [
    `🌍 Voice Environment Context`,
    `• context ID: ${ctx.contextId}`,
    `• environment: ${ctx.environmentType}`,
    `• system load: ${ctx.systemLoad}`,
    `• risk level: ${ctx.riskLevel}`,
    `• adaptation: ${ctx.adaptationAllowance}`,
    `• confidence: ${ctx.confidence}%`,
    `• indicators: ${ctx.indicators.join(", ") || "none"}`,
    `• detected at: ${new Date(ctx.detectedAt).toISOString()}`,
  ].join("\n");
}

export function formatVoiceEnvironmentDetectionResult(
  result: VoiceEnvironmentDetectionResult,
): string {
  const lines = [
    `🔍 Voice Environment Detection`,
    `• reason: ${result.detectionReason}`,
    formatVoiceEnvironmentContext(result.context),
  ];

  if (result.alternativeEnvironments.length > 0) {
    lines.push(`• alternatives: ${result.alternativeEnvironments.join(", ")}`);
  }

  return lines.join("\n");
}
