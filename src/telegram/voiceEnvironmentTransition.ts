/**
 * Voice Environment Transition & Context Switch Governance Layer v7.5
 *
 * First-class entity: VoiceEnvironmentTransition
 *
 * This layer answers:
 *   - "When and how should the system transition between environment contexts?"
 *   - "Is a context switch safe, or does it require validation?"
 *   - "What triggered this transition, and was it governed properly?"
 *
 * This layer does NOT:
 *   - detect environment context (delegated to V7.3)
 *   - adjust policy (delegated to V7.4)
 *   - manage domain-level transitions (delegated to V7.6+)
 *
 * RULE: NO CONTEXT SWITCH WITHOUT GOVERNED TRANSITION
 */

import type { VoiceEnvironmentType } from "./voiceEnvironmentContext.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceEnvironmentTransitionTrigger =
  | "stability_drop"
  | "pressure_spike"
  | "learning_opportunity"
  | "manual_override"
  | "recovery_initiated"
  | "crisis_detected"
  | "growth_window_opened"
  | "test_session_started"
  | "test_session_ended";

export type VoiceEnvironmentTransitionMode =
  | "immediate"
  | "staged"
  | "validated";

export type VoiceEnvironmentTransitionStatus =
  | "proposed"
  | "validated"
  | "in_progress"
  | "completed"
  | "rejected"
  | "rolled_back";

export interface VoiceEnvironmentTransition {
  transitionId: string;

  fromContext: VoiceEnvironmentType;
  toContext: VoiceEnvironmentType;

  trigger: VoiceEnvironmentTransitionTrigger;

  transitionMode: VoiceEnvironmentTransitionMode;

  validationRequired: boolean;

  status: VoiceEnvironmentTransitionStatus;

  transitionedAt: number;

  // Optional metadata for explainability
  reason: string;
  validationErrors: string[];
  completedAt?: number;
  rolledBackAt?: number;
}

export type VoiceEnvironmentTransitionValidationError =
  | "same_context"
  | "invalid_from_context"
  | "invalid_to_context"
  | "invalid_trigger"
  | "transition_not_allowed";

// ============================================================================
// ID generation
// ============================================================================

function generateTransitionId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(3);
  return `voice_trans_${timestamp}_${random}`;
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

const VALID_ENVIRONMENT_TYPES: VoiceEnvironmentType[] = [
  "production",
  "testing",
  "growth",
  "stabilization",
  "crisis",
];

const VALID_TRIGGERS: VoiceEnvironmentTransitionTrigger[] = [
  "stability_drop",
  "pressure_spike",
  "learning_opportunity",
  "manual_override",
  "recovery_initiated",
  "crisis_detected",
  "growth_window_opened",
  "test_session_started",
  "test_session_ended",
];

export function validateTransition(
  fromContext: VoiceEnvironmentType,
  toContext: VoiceEnvironmentType,
  trigger: VoiceEnvironmentTransitionTrigger,
): VoiceEnvironmentTransitionValidationError[] {
  const errors: VoiceEnvironmentTransitionValidationError[] = [];

  if (fromContext === toContext) {
    errors.push("same_context");
  }

  if (!VALID_ENVIRONMENT_TYPES.includes(fromContext)) {
    errors.push("invalid_from_context");
  }

  if (!VALID_ENVIRONMENT_TYPES.includes(toContext)) {
    errors.push("invalid_to_context");
  }

  if (!VALID_TRIGGERS.includes(trigger)) {
    errors.push("invalid_trigger");
  }

  // Check if this transition is logically allowed
  if (!isTransitionAllowed(fromContext, toContext, trigger)) {
    errors.push("transition_not_allowed");
  }

  return errors;
}

// ============================================================================
// Transition rules — what transitions are allowed
// ============================================================================

/**
 * Define which transitions are allowed based on from/to context and trigger.
 * This prevents chaotic context switching.
 */
function isTransitionAllowed(
  from: VoiceEnvironmentType,
  to: VoiceEnvironmentType,
  trigger: VoiceEnvironmentTransitionTrigger,
): boolean {
  const allowedTransitions: Array<{
    from: VoiceEnvironmentType | "*";
    to: VoiceEnvironmentType | "*";
    triggers: VoiceEnvironmentTransitionTrigger[];
  }> = [
    // → crisis: any context can transition to crisis on crisis_detected or stability_drop
    { from: "*", to: "crisis", triggers: ["crisis_detected", "stability_drop", "pressure_spike"] },

    // → stabilization: from crisis on recovery_initiated
    { from: "crisis", to: "stabilization", triggers: ["recovery_initiated"] },

    // → production: from stabilization when stable, or from testing when test ends
    { from: "stabilization", to: "production", triggers: ["stability_drop"] },
    { from: "testing", to: "production", triggers: ["test_session_ended"] },

    // → growth: from production when growth window opens
    { from: "production", to: "growth", triggers: ["growth_window_opened"] },

    // → testing: any context can go to testing on test_session_started
    { from: "*", to: "testing", triggers: ["test_session_started"] },

    // → production: from growth when learning opportunity ends
    { from: "growth", to: "production", triggers: ["learning_opportunity", "stability_drop"] },

    // Manual override: always allowed (human-in-the-loop)
    { from: "*", to: "*", triggers: ["manual_override"] },
  ];

  return allowedTransitions.some(
    (rule) =>
      (rule.from === "*" || rule.from === from) &&
      (rule.to === "*" || rule.to === to) &&
      rule.triggers.includes(trigger),
  );
}

// ============================================================================
// Transition mode determination
// ============================================================================

/**
 * Determine the appropriate transition mode based on context and trigger.
 *
 * Rules:
 * - crisis detected → immediate
 * - growth phase → staged with validation
 * - testing → immediate
 * - stabilization → validated
 * - production → staged
 */
function determineTransitionMode(
  fromContext: VoiceEnvironmentType,
  toContext: VoiceEnvironmentType,
  trigger: VoiceEnvironmentTransitionTrigger,
): VoiceEnvironmentTransitionMode {
  // Crisis transitions are always immediate
  if (toContext === "crisis") return "immediate";

  // Crisis exit requires validation
  if (fromContext === "crisis") return "validated";

  // Testing transitions are immediate
  if (toContext === "testing" || fromContext === "testing") return "immediate";

  // Growth transitions are staged
  if (toContext === "growth" || fromContext === "growth") return "staged";

  // Stabilization transitions require validation
  if (toContext === "stabilization" || fromContext === "stabilization") {
    return "validated";
  }

  // Default: staged for safety
  return "staged";
}

/**
 * Determine if validation is required for this transition.
 */
function isValidationRequired(
  mode: VoiceEnvironmentTransitionMode,
  trigger: VoiceEnvironmentTransitionTrigger,
): boolean {
  // Manual override never requires validation (human already approved)
  if (trigger === "manual_override") return false;

  // Immediate transitions (crisis, testing) skip validation for speed
  if (mode === "immediate") return false;

  // All staged and validated transitions require validation
  return true;
}

// ============================================================================
// Core transition creation
// ============================================================================

export interface VoiceEnvironmentTransitionInput {
  fromContext: VoiceEnvironmentType;
  toContext: VoiceEnvironmentType;
  trigger: VoiceEnvironmentTransitionTrigger;
  reason?: string;
}

/**
 * Create a governed environment transition.
 * Pure function — validates and determines mode automatically.
 */
export function createVoiceEnvironmentTransition(
  input: VoiceEnvironmentTransitionInput,
): {
  transition: VoiceEnvironmentTransition;
  validationErrors: VoiceEnvironmentTransitionValidationError[];
} {
  const validationErrors = validateTransition(
    input.fromContext,
    input.toContext,
    input.trigger,
  );

  const mode = determineTransitionMode(
    input.fromContext,
    input.toContext,
    input.trigger,
  );

  const validationRequired = isValidationRequired(mode, input.trigger);

  const status: VoiceEnvironmentTransitionStatus =
    validationErrors.length > 0 ? "rejected" : "proposed";

  const transition: VoiceEnvironmentTransition = {
    transitionId: generateTransitionId(),
    fromContext: input.fromContext,
    toContext: input.toContext,
    trigger: input.trigger,
    transitionMode: mode,
    validationRequired,
    status,
    transitionedAt: Date.now(),
    reason: input.reason || `Transition ${input.fromContext} → ${input.toContext} triggered by ${input.trigger}`,
    validationErrors: validationErrors.map((e) => e),
  };

  return { transition, validationErrors };
}

// ============================================================================
// Transition lifecycle management
// ============================================================================

export function validateTransitionPhase(
  transition: VoiceEnvironmentTransition,
): VoiceEnvironmentTransition {
  if (transition.validationErrors.length > 0) {
    return { ...transition, status: "rejected" };
  }

  return { ...transition, status: "validated" };
}

export function startTransition(
  transition: VoiceEnvironmentTransition,
): VoiceEnvironmentTransition {
  if (transition.status !== "validated" && transition.status !== "proposed") {
    return transition; // cannot start
  }
  return { ...transition, status: "in_progress" };
}

export function completeTransition(
  transition: VoiceEnvironmentTransition,
): VoiceEnvironmentTransition {
  if (transition.status !== "in_progress") {
    return transition; // cannot complete
  }
  return {
    ...transition,
    status: "completed",
    completedAt: Date.now(),
  };
}

export function rollbackTransition(
  transition: VoiceEnvironmentTransition,
): VoiceEnvironmentTransition {
  return {
    ...transition,
    status: "rolled_back",
    rolledBackAt: Date.now(),
  };
}

export function rejectTransition(
  transition: VoiceEnvironmentTransition,
  reason: string,
): VoiceEnvironmentTransition {
  return {
    ...transition,
    status: "rejected",
    validationErrors: [...transition.validationErrors, reason],
  };
}

// ============================================================================
// Transition log (history)
// ============================================================================

export interface VoiceEnvironmentTransitionLog {
  transitions: VoiceEnvironmentTransition[];
  maxLogSize: number;
}

const DEFAULT_TRANSITION_LOG_MAX = 200;

let _transitionLog: VoiceEnvironmentTransitionLog = {
  transitions: [],
  maxLogSize: DEFAULT_TRANSITION_LOG_MAX,
};

export function getVoiceEnvironmentTransitionLog(): VoiceEnvironmentTransitionLog {
  return { ..._transitionLog };
}

export function addVoiceEnvironmentTransition(
  transition: VoiceEnvironmentTransition,
): void {
  _transitionLog.transitions.push(transition);

  // Trim log to max size
  if (_transitionLog.transitions.length > _transitionLog.maxLogSize) {
    _transitionLog.transitions = _transitionLog.transitions.slice(
      -_transitionLog.maxLogSize,
    );
  }
}

export function clearVoiceEnvironmentTransitionLog(): void {
  _transitionLog = {
    transitions: [],
    maxLogSize: DEFAULT_TRANSITION_LOG_MAX,
  };
}

export function setVoiceEnvironmentTransitionLogForTest(
  log: VoiceEnvironmentTransitionLog,
): void {
  _transitionLog = log;
}

/**
 * Get recent transitions for a given context.
 */
export function getRecentTransitionsForContext(
  contextType: VoiceEnvironmentType,
  limit: number = 10,
): VoiceEnvironmentTransition[] {
  return _transitionLog.transitions
    .filter(
      (t) =>
        t.fromContext === contextType || t.toContext === contextType,
    )
    .slice(-limit);
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceEnvironmentTransition(
  transition: VoiceEnvironmentTransition,
): string {
  const lines = [
    `🔄 Voice Environment Transition`,
    `• transition ID: ${transition.transitionId}`,
    `• from: ${transition.fromContext}`,
    `• to: ${transition.toContext}`,
    `• trigger: ${transition.trigger}`,
    `• mode: ${transition.transitionMode}`,
    `• status: ${transition.status}`,
    `• validation required: ${transition.validationRequired ? "YES" : "NO"}`,
    `• reason: ${transition.reason}`,
    `• transitioned at: ${new Date(transition.transitionedAt).toISOString()}`,
  ];

  if (transition.validationErrors.length > 0) {
    lines.push(`• validation errors: ${transition.validationErrors.join(", ")}`);
  }

  if (transition.completedAt) {
    lines.push(`• completed at: ${new Date(transition.completedAt).toISOString()}`);
  }

  if (transition.rolledBackAt) {
    lines.push(`• rolled back at: ${new Date(transition.rolledBackAt).toISOString()}`);
  }

  return lines.join("\n");
}

export function formatVoiceEnvironmentTransitionLog(
  log: VoiceEnvironmentTransitionLog,
): string {
  const lines = [
    `📜 Voice Environment Transition Log (${log.transitions.length} entries)`,
  ];

  const recent = log.transitions.slice(-5);
  for (const t of recent) {
    lines.push(
      `  ${t.fromContext} → ${t.toContext} [${t.trigger}] (${t.status})`,
    );
  }

  return lines.join("\n");
}
