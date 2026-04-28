/**
 * Voice Governed Change Proposal & Adaptation Input Layer v4.3
 *
 * Generates change proposals from governance signals (consistency conflicts,
 * execution failures, policy violations, performance signals) without
 * applying any changes — only proposing them for control-plane review.
 *
 * This layer answers:
 *   - "What should the system change based on governance evidence?"
 *   - "What is the risk level and does it require human review?"
 *
 * This layer does NOT:
 *   - apply any changes
 *   - mutate runtime config
 *   - change any advisory layers
 *   - use DB / ML / external dependencies
 */

import crypto from "node:crypto";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceProposalSource =
  | "consistency_guard"
  | "execution_failure"
  | "policy_violation"
  | "performance_signal";

export type VoiceProposalType =
  | "policy_adjustment"
  | "threshold_tuning"
  | "reaction_strategy_change"
  | "cooling_adjustment";

export type VoiceProposalRiskLevel =
  | "low"
  | "medium"
  | "high"
  | "critical";

export interface VoiceChangeProposal {
  proposalId: string;
  traceId: string;

  source: VoiceProposalSource;
  triggerRef: string;

  proposalType: VoiceProposalType;

  description: string;

  suggestedChange: {
    target: string;
    currentValue?: unknown;
    proposedValue: unknown;
  };

  riskLevel: VoiceProposalRiskLevel;

  requiresHumanReview: boolean;

  createdAt: number;
}

export interface GenerateVoiceChangeProposalInput {
  traceId: string;
  source: VoiceProposalSource;
  triggerRef: string;
  proposalType: VoiceProposalType;
  description: string;
  suggestedChange: {
    target: string;
    currentValue?: unknown;
    proposedValue: unknown;
  };
}

// ============================================================================
// ID generation
// ============================================================================

function generateProposalId(): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(3).toString("hex");
  return `voice_proposal_${timestamp}_${random}`;
}

// ============================================================================
// Core proposal generator
// ============================================================================

/**
 * Generate a change proposal from governance signals.
 * Pure function — deterministic, bounded, read-only.
 */
export function generateVoiceChangeProposal(
  input: GenerateVoiceChangeProposalInput,
): VoiceChangeProposal {
  const riskLevel = determineRiskLevel(input.proposalType, input.source);
  const requiresHumanReview = riskLevel === "high" || riskLevel === "critical";

  return {
    proposalId: generateProposalId(),
    traceId: input.traceId,
    source: input.source,
    triggerRef: input.triggerRef,
    proposalType: input.proposalType,
    description: input.description,
    suggestedChange: input.suggestedChange,
    riskLevel,
    requiresHumanReview,
    createdAt: Date.now(),
  };
}

// ============================================================================
// Risk level determination
// ============================================================================

function determineRiskLevel(
  proposalType: VoiceProposalType,
  source: VoiceProposalSource,
): VoiceProposalRiskLevel {
  // Execution failures from consistency guard → high
  if (source === "execution_failure") {
    return "high";
  }

  // Policy violations → high
  if (source === "policy_violation") {
    return "high";
  }

  // Consistency guard conflicts → medium-high
  if (source === "consistency_guard") {
    if (proposalType === "reaction_strategy_change") {
      return "high";
    }
    return "medium";
  }

  // Performance signals → low-medium
  if (source === "performance_signal") {
    if (proposalType === "threshold_tuning") {
      return "low";
    }
    return "medium";
  }

  // Default
  return "medium";
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceChangeProposal(
  proposal: VoiceChangeProposal,
): string {
  const lines = [
    `📝 Voice Change Proposal`,
    `• proposal ID: ${proposal.proposalId}`,
    `• trace ID: ${proposal.traceId}`,
    `• source: ${proposal.source}`,
    `• type: ${proposal.proposalType}`,
    `• risk: ${proposal.riskLevel}`,
    `• human review: ${proposal.requiresHumanReview ? "required" : "not required"}`,
    `• trigger: ${proposal.triggerRef}`,
    `• description: ${proposal.description}`,
    `• target: ${proposal.suggestedChange.target}`,
  ];

  return lines.join("\n");
}
