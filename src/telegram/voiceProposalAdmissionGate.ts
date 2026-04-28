/**
 * Voice Proposal Admission Gate & Governance Screening Layer v4.4
 *
 * Screens change proposals before they reach the review queue — rejecting
 * duplicates, blocking forbidden-zone proposals, deferring low-signal
 * proposals, and escalating protected-scope proposals.
 *
 * This layer answers:
 *   - "Is this proposal even admissible for review?"
 *   - "Should it be rejected, deferred, or escalated?"
 *   - "What review mode does it require?"
 *
 * This layer does NOT:
 *   - apply any changes
 *   - mutate runtime config
 *   - bypass consistency guard
 *   - use DB / ML / external dependencies
 */

import crypto from "node:crypto";
import type { VoiceChangeProposal } from "./voiceGovernedChangeProposal.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceProposalAdmissionStatus =
  | "admitted"
  | "rejected"
  | "deferred"
  | "escalated";

export type VoiceProposalAdmissionReasonCode =
  | "missing_evidence"
  | "duplicate_proposal"
  | "unsafe_change_scope"
  | "rate_limited"
  | "low_signal_quality"
  | "high_risk_requires_escalation"
  | "policy_forbidden";

export type VoiceProposalNormalizedPriority =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type VoiceReviewMode =
  | "standard"
  | "human_required"
  | "creator_only"
  | "blocked";

export interface VoiceProposalAdmissionReason {
  code: VoiceProposalAdmissionReasonCode;
  message: string;
}

export interface VoiceProposalAdmissionResult {
  proposalId: string;
  traceId: string;

  admissionStatus: VoiceProposalAdmissionStatus;

  reasons: VoiceProposalAdmissionReason[];

  normalizedPriority: VoiceProposalNormalizedPriority;

  reviewMode: VoiceReviewMode;

  admittedAt: number;
}

export interface EvaluateVoiceProposalAdmissionInput {
  proposal: VoiceChangeProposal;
  recentProposalIds?: string[];
  proposalRatePerMinute?: number;
  evidenceLinked?: boolean;
}

// ============================================================================
// Forbidden scope patterns
// ============================================================================

const FORBIDDEN_TARGET_PATTERNS = [
  "disable_consistency_guard",
  "disable_safety_gate",
  "weaken_human_review",
  "self_expand_privileges",
  "mutate_audit_seal",
  "bypass_execution_gate",
];

function targetsForbiddenScope(
  proposal: VoiceChangeProposal,
): boolean {
  const target = proposal.suggestedChange.target.toLowerCase();
  return FORBIDDEN_TARGET_PATTERNS.some(
    (pattern) => target.includes(pattern),
  );
}

// ============================================================================
// Screening rules
// ============================================================================

/**
 * REJECT — missing evidence
 */
function rejectMissingEvidence(
  proposal: VoiceChangeProposal,
): VoiceProposalAdmissionResult {
  return {
    proposalId: proposal.proposalId,
    traceId: proposal.traceId,
    admissionStatus: "rejected",
    reasons: [{
      code: "missing_evidence",
      message: "Proposal has no linked evidence — cannot be reviewed.",
    }],
    normalizedPriority: "low",
    reviewMode: "blocked",
    admittedAt: Date.now(),
  };
}

/**
 * REJECT — duplicate proposal
 */
function rejectDuplicate(
  proposal: VoiceChangeProposal,
): VoiceProposalAdmissionResult {
  return {
    proposalId: proposal.proposalId,
    traceId: proposal.traceId,
    admissionStatus: "rejected",
    reasons: [{
      code: "duplicate_proposal",
      message: "A similar proposal already exists — duplicate suppressed.",
    }],
    normalizedPriority: "low",
    reviewMode: "blocked",
    admittedAt: Date.now(),
  };
}

/**
 * ESCALATE — forbidden scope
 */
function escalateForbiddenScope(
  proposal: VoiceChangeProposal,
): VoiceProposalAdmissionResult {
  return {
    proposalId: proposal.proposalId,
    traceId: proposal.traceId,
    admissionStatus: "escalated",
    reasons: [{
      code: "policy_forbidden",
      message: "Proposal targets a protected governance zone and requires creator-level review.",
    }],
    normalizedPriority: "critical",
    reviewMode: "creator_only",
    admittedAt: Date.now(),
  };
}

/**
 * DEFER — low signal quality
 */
function deferLowSignal(
  proposal: VoiceChangeProposal,
): VoiceProposalAdmissionResult {
  return {
    proposalId: proposal.proposalId,
    traceId: proposal.traceId,
    admissionStatus: "deferred",
    reasons: [{
      code: "low_signal_quality",
      message: "Signal quality is insufficient — proposal deferred until more evidence accumulates.",
    }],
    normalizedPriority: "low",
    reviewMode: "standard",
    admittedAt: Date.now(),
  };
}

/**
 * DEFER — rate limited
 */
function deferRateLimited(
  proposal: VoiceChangeProposal,
): VoiceProposalAdmissionResult {
  return {
    proposalId: proposal.proposalId,
    traceId: proposal.traceId,
    admissionStatus: "deferred",
    reasons: [{
      code: "rate_limited",
      message: "Proposal generation rate exceeded — deferred to prevent governance noise.",
    }],
    normalizedPriority: "medium",
    reviewMode: "standard",
    admittedAt: Date.now(),
  };
}

/**
 * ESCALATE — high risk / critical
 */
function escalateHighRisk(
  proposal: VoiceChangeProposal,
): VoiceProposalAdmissionResult {
  return {
    proposalId: proposal.proposalId,
    traceId: proposal.traceId,
    admissionStatus: "escalated",
    reasons: [{
      code: "high_risk_requires_escalation",
      message: "Proposal risk level is high — escalated to human/creator review.",
    }],
    normalizedPriority: proposal.riskLevel === "critical" ? "critical" : "high",
    reviewMode: proposal.riskLevel === "critical" ? "creator_only" : "human_required",
    admittedAt: Date.now(),
  };
}

/**
 * ADMIT — passed all screens
 */
function admitProposal(
  proposal: VoiceChangeProposal,
): VoiceProposalAdmissionResult {
  const normalizedPriority =
    proposal.riskLevel === "critical" ? "critical"
      : proposal.riskLevel === "high" ? "high"
        : proposal.riskLevel === "medium" ? "medium"
          : "low";

  const reviewMode =
    proposal.requiresHumanReview ? "human_required"
      : proposal.riskLevel === "high" ? "human_required"
        : "standard";

  return {
    proposalId: proposal.proposalId,
    traceId: proposal.traceId,
    admissionStatus: "admitted",
    reasons: [],
    normalizedPriority,
    reviewMode,
    admittedAt: Date.now(),
  };
}

// ============================================================================
// Core admission gate function
// ============================================================================

/**
 * Screen a change proposal for admissibility.
 * Pure function — deterministic, bounded, read-only.
 */
export function evaluateVoiceProposalAdmission(
  input: EvaluateVoiceProposalAdmissionInput,
): VoiceProposalAdmissionResult {
  const { proposal } = input;

  // RULE 1 — missing evidence → reject
  if (!input.evidenceLinked) {
    return rejectMissingEvidence(proposal);
  }

  // RULE 2 — duplicate → reject
  if (
    input.recentProposalIds &&
    input.recentProposalIds.includes(proposal.proposalId)
  ) {
    return rejectDuplicate(proposal);
  }

  // RULE 3 — forbidden scope → escalate
  if (targetsForbiddenScope(proposal)) {
    return escalateForbiddenScope(proposal);
  }

  // RULE 4 — rate limited → defer
  if (
    input.proposalRatePerMinute !== undefined &&
    input.proposalRatePerMinute > 5
  ) {
    return deferRateLimited(proposal);
  }

  // RULE 5 — high risk → escalate
  if (proposal.riskLevel === "high" || proposal.riskLevel === "critical") {
    return escalateHighRisk(proposal);
  }

  // RULE 6 — admit
  return admitProposal(proposal);
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceProposalAdmissionResult(
  result: VoiceProposalAdmissionResult,
): string {
  const lines = [
    `🔍 Voice Proposal Admission Gate`,
    `• proposal ID: ${result.proposalId}`,
    `• status: ${result.admissionStatus}`,
    `• priority: ${result.normalizedPriority}`,
    `• review mode: ${result.reviewMode}`,
  ];

  if (result.reasons.length > 0) {
    lines.push(`• reasons:`);
    for (const reason of result.reasons) {
      lines.push(`    → ${reason.code}: ${reason.message}`);
    }
  }

  return lines.join("\n");
}
