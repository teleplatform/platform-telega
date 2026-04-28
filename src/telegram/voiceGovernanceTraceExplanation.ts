/**
 * Voice Governance Trace Explanation Layer v3.6
 *
 * Takes all governance advisory layers (V3.0-V3.5) and produces
 * a human-readable explanation of what happened, why, and what the
 * key drivers were across the entire governance chain.
 *
 * This layer answers:
 *   - "Why did the system make these decisions?"
 *   - "What was the full chain of governance reasoning?"
 *   - "What were the key drivers behind the final state?"
 *
 * This layer does NOT:
 *   - change any advisory layers
 *   - change scheduling
 *   - change execution gate
 *   - change runtime config
 *   - launch recheck execution
 *   - use DB / ML / external dependencies
 */

import type { VoiceRecheckLoopStabilityAdvisory } from "./voiceRecheckLoopStabilityAdvisory.js";
import type { VoiceLoopPressureResponseAdvisory } from "./voiceLoopPressureResponseAdvisory.js";
import type { VoiceLoopCoolingPolicyAdvisory } from "./voiceLoopCoolingPolicyAdvisory.js";
import type { VoiceLoopRecoveryResumeAdvisory } from "./voiceLoopRecoveryResumeAdvisory.js";
import type { VoiceLoopPolicyInjectionAdvisory } from "./voiceLoopPolicyInjectionAdvisory.js";
import type { VoicePolicyOverrideSafetyGateResult } from "./voicePolicyOverrideSafetyGate.js";

// ============================================================================
// Domain model
// ============================================================================

export interface VoiceGovernanceTraceExplanation {
  generatedAtMs: number;

  finalDecisionSummary: string;

  explanationSteps: string[];

  keyDrivers: string[];

  riskLevel: "low" | "medium" | "high";

  explanationText: string;
}

export interface BuildVoiceGovernanceTraceInput {
  stability: VoiceRecheckLoopStabilityAdvisory;
  response: VoiceLoopPressureResponseAdvisory;
  cooling: VoiceLoopCoolingPolicyAdvisory;
  resume: VoiceLoopRecoveryResumeAdvisory;
  injection: VoiceLoopPolicyInjectionAdvisory;
  safety: VoicePolicyOverrideSafetyGateResult;
}

// ============================================================================
// Trace builder helpers
// ============================================================================

function buildExplanationSteps(
  input: BuildVoiceGovernanceTraceInput,
): string[] {
  const steps: string[] = [];

  // Step 1 — stability
  steps.push(
    `Loop stability detected: ${input.stability.stabilityStatus} (confidence: ${input.stability.confidence}, pressure: ${input.stability.loopPressure})`,
  );

  // Step 2 — pressure response
  steps.push(
    `Pressure response: ${input.response.response} (${input.response.recommendedAction})`,
  );

  // Step 3 — cooling policy
  steps.push(
    `Cooling policy: ${input.cooling.coolingMode} (strictness: ${input.cooling.strictness})`,
  );

  // Step 4 — resume decision
  steps.push(
    `Resume decision: ${input.resume.resumeDecision} (${input.resume.resumeMode})`,
  );

  // Step 5 — external policy
  steps.push(
    `External policy: ${input.injection.effectiveSignal} → ${input.injection.overrideDecision}`,
  );

  // Step 6 — safety gate
  steps.push(
    `Safety gate: ${input.safety.safetyDecision} → ${input.safety.effectiveOverride}`,
  );

  return steps;
}

function buildKeyDrivers(
  input: BuildVoiceGovernanceTraceInput,
): string[] {
  const drivers: string[] = [];

  // Stability driver
  if (input.stability.stabilityStatus === "unstable") {
    drivers.push("loop instability");
  } else if (input.stability.stabilityStatus === "watch") {
    drivers.push("loop under observation");
  }

  // Pressure driver
  if (input.response.response === "freeze_loop") {
    drivers.push("high loop pressure requiring freeze");
  } else if (input.response.response === "slow_down_loop") {
    drivers.push("elevated pressure requiring slowdown");
  }

  // External override driver
  if (input.injection.overrideDecision !== "no_override") {
    drivers.push(`external ${input.injection.overrideDecision} attempt`);
  }

  // Safety block driver
  if (input.safety.safetyDecision === "block_override") {
    drivers.push("safety gate blocked external override");
  } else if (input.safety.safetyDecision === "restrict_override") {
    drivers.push("safety gate restricted external override");
  }

  // If none of the above, default driver
  if (drivers.length === 0) {
    drivers.push("stable loop with no external intervention");
  }

  return drivers;
}

function buildRiskLevel(
  input: BuildVoiceGovernanceTraceInput,
): "low" | "medium" | "high" {
  // Safety block → high risk
  if (input.safety.safetyDecision === "block_override") {
    return "high";
  }

  // Hard strictness → medium/high
  if (input.cooling.strictness === "high") {
    return input.stability.stabilityStatus === "unstable" ? "high" : "medium";
  }

  // Soft strictness → medium
  if (input.cooling.strictness === "medium") {
    return "medium";
  }

  // Default → low
  return "low";
}

function buildFinalDecisionSummary(
  input: BuildVoiceGovernanceTraceInput,
): string {
  const stability = input.stability.stabilityStatus;
  const safety = input.safety.safetyDecision;
  const cooling = input.cooling.coolingMode;

  if (stability === "unstable" && safety === "block_override") {
    return `Loop remains frozen due to instability; unsafe external override was blocked by safety gate.`;
  }

  if (stability === "unstable") {
    return `Loop is unstable; external override was restricted and cooling policy applied to protect system integrity.`;
  }

  if (stability === "watch" && safety === "restrict_override") {
    return `Loop under observation; external override limited to prevent disruption to fragile stability.`;
  }

  if (stability === "watch") {
    return `Loop under watch; cooling policy active and external influence moderated.`;
  }

  if (safety === "block_override") {
    return `External override blocked by safety gate despite stable loop; safety check prevented potential disruption.`;
  }

  if (input.injection.overrideDecision !== "no_override") {
    return `Loop stable; external override applied at ${input.injection.overrideDecision} level after safety validation.`;
  }

  return `Loop is stable with no external intervention required; governance chain confirms healthy self-regulated state.`;
}

function buildExplanationText(
  input: BuildVoiceGovernanceTraceInput,
): string {
  const parts: string[] = [];

  // Stability explanation
  switch (input.stability.stabilityStatus) {
    case "unstable":
      parts.push("The voice loop entered an unstable state, indicating repeated blocking or stalling patterns.");
      break;
    case "watch":
      parts.push("The voice loop shows mild instability signals and remains under observation.");
      break;
    default:
      parts.push("The voice loop appears stable based on recent execution readiness memory.");
  }

  // Pressure response explanation
  switch (input.response.response) {
    case "freeze_loop":
      parts.push("This triggered a freeze response to prevent further instability.");
      break;
    case "slow_down_loop":
      parts.push("A slowdown response was applied to reduce loop cadence.");
      break;
    case "investigate_loop":
      parts.push("An investigation response was triggered due to low-confidence stability.");
      break;
    default:
      parts.push("No pressure response was needed as the loop is healthy.");
  }

  // Cooling explanation
  if (input.cooling.coolingMode === "freeze_until_manual_review") {
    parts.push("A freeze cooling policy was applied, requiring manual review before any resume.");
  } else if (input.cooling.coolingMode === "hard_cooldown") {
    parts.push("A hard cooldown was applied, requiring a significant interval before resuming.");
  } else if (input.cooling.coolingMode === "soft_cooldown") {
    parts.push("A soft cooldown was applied, allowing gradual resume after evidence collection.");
  }

  // External policy explanation
  if (input.injection.overrideDecision === "no_override") {
    parts.push("No external policy intervention was active.");
  } else if (input.safety.safetyDecision === "block_override") {
    parts.push(`An external ${input.injection.overrideDecision} was detected but blocked by the safety gate to protect loop integrity.`);
  } else if (input.safety.safetyDecision === "restrict_override") {
    parts.push(`An external ${input.injection.overrideDecision} was detected and restricted by the safety gate.`);
  } else {
    parts.push(`An external ${input.injection.overrideDecision} was detected and allowed after safety validation.`);
  }

  // Final state
  switch (input.resume.resumeDecision) {
    case "resume_normal":
      parts.push("The system will resume at normal cadence.");
      break;
    case "resume_cautiously":
      parts.push("The system will resume cautiously with increased monitoring.");
      break;
    default:
      parts.push("The system remains in its current protected state.");
  }

  return parts.join(" ");
}

// ============================================================================
// Core trace builder function
// ============================================================================

/**
 * Build a governance trace explanation from all advisory layers.
 * Pure function — deterministic, bounded, read-only.
 */
export function buildVoiceGovernanceTrace(
  input: BuildVoiceGovernanceTraceInput,
): VoiceGovernanceTraceExplanation {
  const explanationSteps = buildExplanationSteps(input);
  const keyDrivers = buildKeyDrivers(input);
  const riskLevel = buildRiskLevel(input);
  const finalDecisionSummary = buildFinalDecisionSummary(input);
  const explanationText = buildExplanationText(input);

  return {
    generatedAtMs: Date.now(),
    finalDecisionSummary,
    explanationSteps,
    keyDrivers,
    riskLevel,
    explanationText,
  };
}

// ============================================================================
// Formatter for human reading
// ============================================================================

/**
 * Format a governance trace explanation for operator review.
 * Designed for CLI output, Telegram admin messages, or future dashboards.
 */
export function formatVoiceGovernanceTraceExplanation(
  trace: VoiceGovernanceTraceExplanation,
): string {
  const lines = [
    `📋 Voice Governance Trace Explanation`,
    `• risk level: ${trace.riskLevel}`,
    `• summary: ${trace.finalDecisionSummary}`,
    ``,
    `Explanation steps:`,
    ...trace.explanationSteps.map((step) => `  → ${step}`),
    ``,
    `Key drivers:`,
    ...trace.keyDrivers.map((d) => `  • ${d}`),
    ``,
    `Full explanation:`,
    trace.explanationText,
  ];

  return lines.join("\n");
}
