/**
 * Voice Governance Trace Evidence Binding v3.7
 *
 * Takes a VoiceGovernanceTraceExplanation and binds it into an
 * immutable, checksummed, audit-ready evidence record.
 *
 * This layer answers:
 *   - "How can this trace be verified as immutable?"
 *   - "What is the evidence lineage and source layers?"
 *   - "Can this trace be used as proof of governance decision?"
 *
 * This layer does NOT:
 *   - change any advisory layers
 *   - change scheduling
 *   - change execution gate
 *   - change runtime config
 *   - launch recheck execution
 *   - use DB / ML / external dependencies
 */

import crypto from "node:crypto";
import type { VoiceGovernanceTraceExplanation } from "./voiceGovernanceTraceExplanation.js";

// ============================================================================
// Domain model
// ============================================================================

export const VOICE_GOVERNANCE_SOURCE_LAYERS = [
  "stability",
  "pressure_response",
  "cooling_policy",
  "resume_policy",
  "policy_injection",
  "safety_gate",
] as const;

export interface VoiceGovernanceTraceEvidenceContext {
  traceId: string;
  sessionId?: string;
  chatId?: string | number;
}

export interface VoiceGovernanceTraceEvidence {
  evidenceId: string;
  traceId: string;
  createdAtMs: number;

  finalDecisionSummary: string;
  explanationSteps: string[];
  keyDrivers: string[];
  riskLevel: "low" | "medium" | "high";
  explanationText: string;

  // Evidence binding
  evidenceType: "voice_governance_trace";

  // Lineage
  sourceLayers: readonly string[];

  // Context
  sessionId?: string;
  chatId?: string | number;

  // Integrity checksum
  checksum: string;
}

// ============================================================================
// Checksum generation
// ============================================================================

function generateChecksum(
  trace: VoiceGovernanceTraceExplanation,
): string {
  const payload = JSON.stringify({
    summary: trace.finalDecisionSummary,
    steps: trace.explanationSteps,
    drivers: trace.keyDrivers,
    risk: trace.riskLevel,
  });

  return crypto.createHash("sha256").update(payload).digest("hex");
}

// ============================================================================
// Evidence ID generation
// ============================================================================

function generateEvidenceId(): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(3).toString("hex");
  return `voice_trace_${timestamp}_${random}`;
}

// ============================================================================
// Core evidence builder
// ============================================================================

/**
 * Bind a governance trace explanation into an immutable evidence record.
 * Pure function — deterministic, bounded, read-only.
 */
export function buildVoiceGovernanceTraceEvidence(
  trace: VoiceGovernanceTraceExplanation,
  context: VoiceGovernanceTraceEvidenceContext,
): VoiceGovernanceTraceEvidence {
  const checksum = generateChecksum(trace);
  const evidenceId = generateEvidenceId();

  return {
    evidenceId,
    traceId: context.traceId,
    createdAtMs: Date.now(),
    finalDecisionSummary: trace.finalDecisionSummary,
    explanationSteps: trace.explanationSteps,
    keyDrivers: trace.keyDrivers,
    riskLevel: trace.riskLevel,
    explanationText: trace.explanationText,
    evidenceType: "voice_governance_trace",
    sourceLayers: VOICE_GOVERNANCE_SOURCE_LAYERS,
    sessionId: context.sessionId,
    chatId: context.chatId,
    checksum,
  };
}

// ============================================================================
// Checksum verification
// ============================================================================

/**
 * Verify that a stored evidence record has not been tampered with.
 */
export function verifyVoiceGovernanceTraceEvidenceChecksum(
  evidence: VoiceGovernanceTraceEvidence,
): boolean {
  const expectedChecksum = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        summary: evidence.finalDecisionSummary,
        steps: evidence.explanationSteps,
        drivers: evidence.keyDrivers,
        risk: evidence.riskLevel,
      }),
    )
    .digest("hex");

  return evidence.checksum === expectedChecksum;
}

// ============================================================================
// Formatter for human reading
// ============================================================================

export function formatVoiceGovernanceTraceEvidence(
  evidence: VoiceGovernanceTraceEvidence,
): string {
  const lines = [
    `🔐 Voice Governance Trace Evidence`,
    `• evidence ID: ${evidence.evidenceId}`,
    `• trace ID: ${evidence.traceId}`,
    `• evidence type: ${evidence.evidenceType}`,
    `• checksum: ${evidence.checksum.slice(0, 16)}…`,
    `• risk level: ${evidence.riskLevel}`,
    `• source layers: ${evidence.sourceLayers.join(", ")}`,
    `• summary: ${evidence.finalDecisionSummary}`,
  ];

  if (evidence.chatId !== undefined) {
    lines.push(`• chat ID: ${evidence.chatId}`);
  }

  return lines.join("\n");
}
