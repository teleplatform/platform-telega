/**
 * Voice Adaptation Constitutional Policy Gate v5.1
 *
 * Evaluates adaptation candidates against constitutional constraints —
 * rejecting those that violate safety, audit integrity, human control,
 * or attempt self-expansion.
 *
 * This layer answers:
 *   - "Is this adaptation candidate constitutionally permissible?"
 *   - "Does it preserve human control, audit integrity, and safety?"
 *   - "Should it be allowed, rejected, deferred, or escalated?"
 *
 * This layer does NOT:
 *   - apply any adaptations
 *   - change runtime config
 *   - mutate execution truth
 *   - use DB / ML / external dependencies
 */

import type { VoiceAdaptationCandidate } from "./voiceAdaptationCandidateSynthesis.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceAdaptationGateStatus =
  | "allowed"
  | "rejected"
  | "deferred"
  | "escalated";

export type VoiceConstitutionalCheckName =
  | "scope_safety"
  | "review_preservation"
  | "audit_integrity"
  | "consistency_preservation"
  | "human_control_preservation"
  | "anti_self_expansion";

export interface VoiceConstitutionalCheck {
  check: VoiceConstitutionalCheckName;
  passed: boolean;
  reason?: string;
}

export type VoiceAdaptationReviewMode =
  | "standard"
  | "human_required"
  | "creator_only"
  | "blocked";

export type VoiceAdaptationNormalizedRisk =
  | "low"
  | "medium"
  | "high"
  | "critical";

export interface VoiceAdaptationGateResult {
  candidateId: string;
  gateStatus: VoiceAdaptationGateStatus;
  constitutionalChecks: VoiceConstitutionalCheck[];
  finalReviewMode: VoiceAdaptationReviewMode;
  normalizedRisk: VoiceAdaptationNormalizedRisk;
  decidedAt: number;
}

const FORBIDDEN_TARGETS = [
  "disable_consistency_guard",
  "disable_safety_gate",
  "weaken_human_review",
  "self_expand_privileges",
  "mutate_audit_seal",
  "bypass_execution_gate",
  "disable_admission_gate",
  "disable_review_queue",
  "disable_learning_aggregation",
  "disable_constitutional_gate",
];

// ============================================================================
// Constitutional checks
// ============================================================================

function checkScopeSafety(
  candidate: VoiceAdaptationCandidate,
): { passed: boolean; reason?: string } {
  const target = candidate.proposedDelta.targetKey.toLowerCase();
  const forbidden = FORBIDDEN_TARGETS.find((p) => target.includes(p));
  if (forbidden) {
    return { passed: false, reason: `Candidate targets forbidden scope: ${forbidden}` };
  }
  return { passed: true };
}

function checkReviewPreservation(
  candidate: VoiceAdaptationCandidate,
): { passed: boolean; reason?: string } {
  const target = candidate.proposedDelta.targetKey.toLowerCase();
  if (target.includes("review") && candidate.candidateType === "deprecate") {
    return { passed: false, reason: "Cannot deprecate review-related mechanisms" };
  }
  return { passed: true };
}

function checkAuditIntegrity(
  candidate: VoiceAdaptationCandidate,
): { passed: boolean; reason?: string } {
  const target = candidate.proposedDelta.targetKey.toLowerCase();
  if (target.includes("audit") || target.includes("lineage") || target.includes("seal")) {
    return { passed: false, reason: "Candidate targets audit/lineage integrity" };
  }
  return { passed: true };
}

function checkConsistencyPreservation(
  candidate: VoiceAdaptationCandidate,
): { passed: boolean; reason?: string } {
  const target = candidate.proposedDelta.targetKey.toLowerCase();
  if (target.includes("consistency") && candidate.candidateType === "loosen") {
    return { passed: false, reason: "Cannot loosen consistency guard" };
  }
  return { passed: true };
}

function checkHumanControlPreservation(
  candidate: VoiceAdaptationCandidate,
): { passed: boolean; reason?: string } {
  if (candidate.candidateType === "deprecate" && candidate.requiresHumanReview) {
    return { passed: false, reason: "Cannot deprecate human-review-required adaptations" };
  }
  return { passed: true };
}

function checkAntiSelfExpansion(
  candidate: VoiceAdaptationCandidate,
): { passed: boolean; reason?: string } {
  const target = candidate.proposedDelta.targetKey.toLowerCase();
  if (target.includes("self") || target.includes("privilege") || target.includes("expand")) {
    return { passed: false, reason: "Candidate attempts self-expansion" };
  }
  return { passed: true };
}

// ============================================================================
// Core gate function
// ============================================================================

/**
 * Evaluate constitutional permissibility of an adaptation candidate.
 * Pure function — deterministic, bounded, read-only.
 */
export function evaluateAdaptationConstitutionalGate(
  candidate: VoiceAdaptationCandidate,
): VoiceAdaptationGateResult {
  const checks: VoiceConstitutionalCheck[] = [
    { check: "scope_safety", ...checkScopeSafety(candidate) },
    { check: "review_preservation", ...checkReviewPreservation(candidate) },
    { check: "audit_integrity", ...checkAuditIntegrity(candidate) },
    { check: "consistency_preservation", ...checkConsistencyPreservation(candidate) },
    { check: "human_control_preservation", ...checkHumanControlPreservation(candidate) },
    { check: "anti_self_expansion", ...checkAntiSelfExpansion(candidate) },
  ];

  const failedChecks = checks.filter((c) => !c.passed);
  const allPassed = failedChecks.length === 0;

  // Determine gate status
  let gateStatus: VoiceAdaptationGateStatus;
  let reviewMode: VoiceAdaptationReviewMode;
  let normalizedRisk: VoiceAdaptationNormalizedRisk;

  // Map risk from candidate
  normalizedRisk = candidate.riskClass;

  if (!allPassed) {
    // Any constitutional failure → blocked
    gateStatus = "rejected";
    reviewMode = "blocked";
  } else if (candidate.riskClass === "critical") {
    gateStatus = "escalated";
    reviewMode = "creator_only";
  } else if (candidate.riskClass === "high") {
    gateStatus = "escalated";
    reviewMode = "human_required";
  } else if (candidate.supportLevel === "weak") {
    gateStatus = "deferred";
    reviewMode = "standard";
  } else {
    gateStatus = "allowed";
    reviewMode = candidate.requiresHumanReview ? "human_required" : "standard";
  }

  return {
    candidateId: candidate.candidateId,
    gateStatus,
    constitutionalChecks: checks,
    finalReviewMode: reviewMode,
    normalizedRisk,
    decidedAt: Date.now(),
  };
}

// ============================================================================
// Formatter
// ============================================================================

export function formatAdaptationGateResult(
  result: VoiceAdaptationGateResult,
): string {
  const lines = [
    `🛡️ Voice Adaptation Constitutional Gate`,
    `• candidate ID: ${result.candidateId}`,
    `• status: ${result.gateStatus}`,
    `• risk: ${result.normalizedRisk}`,
    `• review mode: ${result.finalReviewMode}`,
  ];

  for (const check of result.constitutionalChecks) {
    const icon = check.passed ? "✅" : "❌";
    lines.push(`  ${icon} ${check.check}: ${check.passed ? "passed" : "FAILED"}`);
    if (check.reason) {
      lines.push(`     → ${check.reason}`);
    }
  }

  return lines.join("\n");
}
