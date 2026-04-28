/**
 * Voice Governance Reaction & Escalation Layer v3.8
 *
 * Takes a VoiceGovernanceTraceEvidence and determines what the system
 * should actively DO in response to the governance outcome — turning
 * passive observation into governed autonomous reaction.
 *
 * This layer answers:
 *   - "What should the system do based on this governance evidence?"
 *   - "Is escalation required?"
 *   - "Should channels be locked, cooling increased, or human review triggered?"
 *
 * This layer does NOT:
 *   - actually execute reactions (advisory only)
 *   - change scheduling
 *   - change execution gate
 *   - change runtime config
 *   - launch recheck execution
 *   - use DB / ML / external dependencies
 */

import type { VoiceGovernanceTraceEvidence } from "./voiceGovernanceTraceEvidence.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceGovernanceReactionAction =
  | "no_action"
  | "increase_cooling"
  | "lock_override_channel"
  | "request_human_review"
  | "escalate_to_creator"
  | "enter_protected_mode";

export interface VoiceGovernanceReactionResult {
  decidedAtMs: number;

  action: VoiceGovernanceReactionAction;

  reason: string;

  severity: "low" | "medium" | "high";

  triggeredBy: string[];

  summary: string;
  reactionInstruction: string;
}

// ============================================================================
// Reaction rules
// ============================================================================

/**
 * RULE 1 — lock_override_channel
 *
 * Triggered by:
 *   - riskLevel === "high" AND keyDrivers includes "override" + "blocked"
 *
 * Unsafe external override was attempted and blocked — channel must be locked.
 */
function buildLockOverrideChannel(
  evidence: VoiceGovernanceTraceEvidence,
): VoiceGovernanceReactionResult {
  return {
    decidedAtMs: Date.now(),
    action: "lock_override_channel",
    reason: "Unsafe external override attempt blocked by safety gate.",
    severity: "high",
    triggeredBy: ["override_blocked", "safety_gate"],
    summary:
      "External override channel must be locked — unsafe override attempt detected and blocked.",
    reactionInstruction:
      "Lock the external override channel and require manual clearance before allowing future overrides.",
  };
}

/**
 * RULE 2 — enter_protected_mode
 *
 * Triggered by:
 *   - riskLevel === "high" AND stability-related drivers present
 *
 * System is highly unstable — enter protected mode to prevent further damage.
 */
function buildEnterProtectedMode(
  evidence: VoiceGovernanceTraceEvidence,
): VoiceGovernanceReactionResult {
  return {
    decidedAtMs: Date.now(),
    action: "enter_protected_mode",
    reason: "High risk level with instability detected — system must protect itself.",
    severity: "high",
    triggeredBy: ["high_risk", "instability"],
    summary:
      "System must enter protected mode due to high risk and instability in the governance chain.",
    reactionInstruction:
      "Enter protected mode — restrict all non-essential operations and prioritize stabilization.",
  };
}

/**
 * RULE 3 — increase_cooling
 *
 * Triggered by:
 *   - keyDrivers includes "instability" OR "freeze"
 *
 * Loop is unstable — cooling must be increased regardless of current policy.
 */
function buildIncreaseCooling(
  evidence: VoiceGovernanceTraceEvidence,
): VoiceGovernanceReactionResult {
  return {
    decidedAtMs: Date.now(),
    action: "increase_cooling",
    reason: "Loop instability detected — cooling policy must be strengthened.",
    severity: "high",
    triggeredBy: ["instability", "freeze_response"],
    summary:
      "Cooling policy must be increased — loop instability requires stronger protective measures.",
    reactionInstruction:
      "Increase the cooling interval and avoid any aggressive recheck cadence until stability returns.",
  };
}

/**
 * RULE 4 — escalate_to_creator
 *
 * Triggered by:
 *   - riskLevel === "medium" AND external override-related drivers
 *
 * System under controlled pressure from external policy — escalate to creator for review.
 */
function buildEscalateToCreator(
  evidence: VoiceGovernanceTraceEvidence,
): VoiceGovernanceReactionResult {
  return {
    decidedAtMs: Date.now(),
    action: "escalate_to_creator",
    reason: "External policy pressure requires creator-level review.",
    severity: "medium",
    triggeredBy: ["external_policy", "restricted_override"],
    summary:
      "External policy influence detected at medium risk level — escalation to creator required.",
    reactionInstruction:
      "Notify the creator about external policy pressure and request strategic guidance on override policy.",
  };
}

/**
 * RULE 5 — request_human_review
 *
 * Triggered by:
 *   - riskLevel === "medium"
 *
 * System under controlled pressure — human review needed to assess the situation.
 */
function buildRequestHumanReview(
  evidence: VoiceGovernanceTraceEvidence,
): VoiceGovernanceReactionResult {
  return {
    decidedAtMs: Date.now(),
    action: "request_human_review",
    reason: "System under controlled pressure — human assessment needed.",
    severity: "medium",
    triggeredBy: ["controlled_pressure", "cooling_active"],
    summary:
      "Human review requested — system is under controlled pressure and requires operator assessment.",
    reactionInstruction:
      "Queue this case for human operator review and continue monitoring loop behavior.",
  };
}

/**
 * RULE 6 — no_action (default safe case)
 *
 * Triggered by:
 *   - riskLevel === "low"
 *
 * System is stable — no reaction required.
 */
function buildNoAction(
  evidence: VoiceGovernanceTraceEvidence,
): VoiceGovernanceReactionResult {
  return {
    decidedAtMs: Date.now(),
    action: "no_action",
    reason: "System is stable — no governance reaction required.",
    severity: "low",
    triggeredBy: [],
    summary:
      "No governance reaction needed — voice loop is stable with no risk indicators.",
    reactionInstruction:
      "Continue normal operation under current bounded scheduling and execution policy.",
  };
}

// ============================================================================
// Core reaction evaluation function
// ============================================================================

/**
 * Evaluate governance reaction from an evidence record.
 * Pure function — deterministic, bounded, read-only.
 */
export function evaluateVoiceGovernanceReaction(
  evidence: VoiceGovernanceTraceEvidence,
): VoiceGovernanceReactionResult {
  const drivers = evidence.keyDrivers;
  const riskLevel = evidence.riskLevel;

  const hasOverrideBlocked = drivers.some(
    (d) => d.toLowerCase().includes("override") && d.toLowerCase().includes("block"),
  );
  const hasInstability = drivers.some(
    (d) => d.toLowerCase().includes("instability") || d.toLowerCase().includes("unstable"),
  );
  const hasFreeze = drivers.some(
    (d) => d.toLowerCase().includes("freeze"),
  );
  const hasExternalPolicy = drivers.some(
    (d) => d.toLowerCase().includes("external") || d.toLowerCase().includes("override"),
  );

  // RULE 1 — lock_override_channel (highest priority)
  if (riskLevel === "high" && hasOverrideBlocked) {
    return buildLockOverrideChannel(evidence);
  }

  // RULE 2 — enter_protected_mode
  if (riskLevel === "high" && hasInstability) {
    return buildEnterProtectedMode(evidence);
  }

  // RULE 3 — increase_cooling
  if (hasInstability || hasFreeze) {
    return buildIncreaseCooling(evidence);
  }

  // RULE 4 — escalate_to_creator
  if (riskLevel === "medium" && hasExternalPolicy) {
    return buildEscalateToCreator(evidence);
  }

  // RULE 5 — request_human_review
  if (riskLevel === "medium") {
    return buildRequestHumanReview(evidence);
  }

  // RULE 6 — no_action (default)
  return buildNoAction(evidence);
}

// ============================================================================
// Formatter for human reading
// ============================================================================

export function formatVoiceGovernanceReactionResult(
  result: VoiceGovernanceReactionResult,
): string {
  const lines = [
    `⚡ Voice Governance Reaction`,
    `• action: ${result.action}`,
    `• severity: ${result.severity}`,
    `• reason: ${result.reason}`,
    `• summary: ${result.summary}`,
    `• reaction instruction: ${result.reactionInstruction}`,
  ];

  if (result.triggeredBy.length > 0) {
    lines.push(`• triggered by: ${result.triggeredBy.join(", ")}`);
  }

  return lines.join("\n");
}
