/**
 * Voice Effect Lineage & Audit Envelope v4.0
 *
 * Builds a continuous, verifiable chain of evidence linking every step
 * of the governance lifecycle — from intent through execution to confirmed effect.
 *
 * This layer answers:
 *   - "Can every step in the governance chain be proven?"
 *   - "Is the lineage complete and sealed?"
 *   - "Can this record be audited and replayed?"
 *
 * This layer does NOT:
 *   - mutate any advisory layers
 *   - change runtime config
 *   - launch recheck execution
 *   - use DB / ML / external dependencies
 */

import crypto from "node:crypto";
import type { VoiceGovernanceTraceEvidence } from "./voiceGovernanceTraceEvidence.js";
import type { VoiceGovernanceReactionResult } from "./voiceGovernanceReactionLayer.js";
import type { VoiceGovernanceReactionExecutionResult } from "./voiceGovernanceReactionExecution.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceLineageStep =
  | "intent"
  | "decision"
  | "reaction"
  | "execution"
  | "effect";

export type VoiceAnchorType =
  | "effect_confirmed"
  | "effect_failed"
  | "governance_transition"
  | "resume_marker"
  | "replay_marker"
  | "consistency_passed"
  | "consistency_failed";

export type VoiceEffectStatus =
  | "pending"
  | "confirmed"
  | "failed"
  | "unknown";

export type VoiceConfirmationType =
  | "system_ack"
  | "external_ack"
  | "user_ack";

// ============================================================================
// Effect Lineage
// ============================================================================

export interface VoiceEffectLineage {
  traceId: string;

  intentId: string;
  decisionId: string;
  reactionId: string;

  executionId: string;
  effectId: string;

  lineageChain: Array<{
    step: VoiceLineageStep;
    refId: string;
    timestamp: number;
  }>;

  isComplete: boolean;
  isSealed: boolean;
}

// ============================================================================
// Effect Record
// ============================================================================

export interface VoiceEffectRecord {
  effectId: string;

  executionId: string;
  reactionId: string;

  status: VoiceEffectStatus;

  confirmationType: VoiceConfirmationType;

  confirmedAt?: number;

  evidenceRefs: string[];

  isAnchor: boolean;
}

// ============================================================================
// Evidence Anchor
// ============================================================================

export interface VoiceEvidenceAnchor {
  anchorType: VoiceAnchorType;
  refId: string;
  timestamp: number;
}

// ============================================================================
// Audit Envelope
// ============================================================================

export interface VoiceAuditEnvelope {
  traceId: string;

  lineage: VoiceEffectLineage;

  execution: {
    executionId: string;
    startedAt: number;
    completedAt?: number;
    status: string;
  };

  effect: VoiceEffectRecord;

  anchors: VoiceEvidenceAnchor[];

  artifacts: string[];

  governance: {
    policyScope: string;
    decisionMode: "auto" | "human" | "hybrid";
  };

  isValid: boolean;
}

// ============================================================================
// ID generation
// ============================================================================

function generateEffectId(): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(3).toString("hex");
  return `voice_effect_${timestamp}_${random}`;
}

function generateIntentId(traceId: string): string {
  return `voice_intent_${traceId}`;
}

function generateDecisionId(traceId: string): string {
  return `voice_decision_${traceId}`;
}

function generateReactionId(evidenceId: string): string {
  return `voice_reaction_${evidenceId.slice(0, 16)}`;
}

// ============================================================================
// Lineage builder
// ============================================================================

function buildLineage(
  traceId: string,
  evidence: VoiceGovernanceTraceEvidence,
  reaction: VoiceGovernanceReactionResult,
  execution: VoiceGovernanceReactionExecutionResult,
  effectId: string,
): VoiceEffectLineage {
  const intentId = generateIntentId(traceId);
  const decisionId = generateDecisionId(traceId);
  const reactionId = generateReactionId(evidence.evidenceId);
  const now = Date.now();

  const lineageChain: VoiceEffectLineage["lineageChain"] = [
    { step: "intent", refId: intentId, timestamp: now },
    { step: "decision", refId: decisionId, timestamp: now },
    { step: "reaction", refId: reactionId, timestamp: now },
    { step: "execution", refId: execution.executionId, timestamp: execution.startedAtMs },
    { step: "effect", refId: effectId, timestamp: now },
  ];

  // Check completeness — all links present
  const isComplete =
    !!intentId &&
    !!decisionId &&
    !!reactionId &&
    !!execution.executionId &&
    !!effectId;

  return {
    traceId,
    intentId,
    decisionId,
    reactionId,
    executionId: execution.executionId,
    effectId,
    lineageChain,
    isComplete,
    isSealed: false, // Not sealed until effect confirmed
  };
}

// ============================================================================
// Effect record builder
// ============================================================================

function buildEffectRecord(
  effectId: string,
  execution: VoiceGovernanceReactionExecutionResult,
  reaction: VoiceGovernanceReactionResult,
): VoiceEffectRecord {
  const status: VoiceEffectStatus =
    execution.effectConfirmed ? "confirmed" : "pending";

  const confirmationType: VoiceConfirmationType = "system_ack";

  const evidenceRefs = [execution.executionId];

  return {
    effectId,
    executionId: execution.executionId,
    reactionId: reaction.action,
    status,
    confirmationType,
    confirmedAt: execution.effectConfirmed ? Date.now() : undefined,
    evidenceRefs,
    isAnchor: execution.effectConfirmed,
  };
}

// ============================================================================
// Seal logic
// ============================================================================

function sealLineage(lineage: VoiceEffectLineage): VoiceEffectLineage {
  if (!lineage.isComplete) {
    return lineage; // Cannot seal incomplete lineage
  }
  return { ...lineage, isSealed: true };
}

// ============================================================================
// Audit envelope validation
// ============================================================================

function validateAuditEnvelope(
  envelope: VoiceAuditEnvelope,
): boolean {
  // Lineage must be complete
  if (!envelope.lineage.isComplete) {
    return false;
  }

  // Effect must be confirmed or pending (not failed/unknown for valid envelope)
  if (envelope.effect.status === "failed") {
    return false;
  }

  // Execution must have completed
  if (!envelope.execution.completedAt) {
    return false;
  }

  // Must have at least one anchor
  if (envelope.anchors.length === 0) {
    return false;
  }

  return true;
}

// ============================================================================
// Core audit envelope builder
// ============================================================================

export interface BuildVoiceAuditEnvelopeInput {
  traceId: string;
  evidence: VoiceGovernanceTraceEvidence;
  reaction: VoiceGovernanceReactionResult;
  execution: VoiceGovernanceReactionExecutionResult;
}

/**
 * Build a complete audit envelope with effect lineage from governance evidence.
 * Pure function — deterministic, bounded, read-only (except timestamp generation).
 */
export function buildVoiceAuditEnvelope(
  input: BuildVoiceAuditEnvelopeInput,
): VoiceAuditEnvelope {
  const { traceId, evidence, reaction, execution } = input;

  const effectId = generateEffectId();

  // Build lineage
  const lineage = buildLineage(traceId, evidence, reaction, execution, effectId);

  // Build effect record
  const effect = buildEffectRecord(effectId, execution, reaction);

  // Seal if effect confirmed
  const sealedLineage = execution.effectConfirmed ? sealLineage(lineage) : lineage;

  // Build anchors
  const anchors: VoiceEvidenceAnchor[] = [];

  if (execution.effectConfirmed) {
    anchors.push({
      anchorType: "effect_confirmed",
      refId: effectId,
      timestamp: Date.now(),
    });
  }

  // Governance transition anchor
  anchors.push({
    anchorType: "governance_transition",
    refId: evidence.evidenceId,
    timestamp: evidence.createdAtMs,
  });

  // Build artifacts list
  const artifacts = [
    evidence.evidenceId,
    execution.executionId,
    effectId,
  ];

  // Build audit envelope
  const envelope: VoiceAuditEnvelope = {
    traceId,
    lineage: sealedLineage,
    execution: {
      executionId: execution.executionId,
      startedAt: execution.startedAtMs,
      completedAt: execution.completedAtMs,
      status: execution.status,
    },
    effect,
    anchors,
    artifacts,
    governance: {
      policyScope: `voice_loop_${evidence.riskLevel}`,
      decisionMode: execution.effectConfirmed ? "auto" : "hybrid",
    },
    isValid: true, // Will validate below
  };

  // Validate
  envelope.isValid = validateAuditEnvelope(envelope);

  return envelope;
}

// ============================================================================
// Checksum for audit envelope
// ============================================================================

export function computeAuditEnvelopeChecksum(
  envelope: VoiceAuditEnvelope,
): string {
  const payload = JSON.stringify({
    traceId: envelope.traceId,
    lineageComplete: envelope.lineage.isComplete,
    lineageSealed: envelope.lineage.isSealed,
    executionId: envelope.execution.executionId,
    effectStatus: envelope.effect.status,
    anchors: envelope.anchors,
    artifacts: envelope.artifacts,
  });

  return crypto.createHash("sha256").update(payload).digest("hex");
}

// ============================================================================
// Formatter for human reading
// ============================================================================

export function formatVoiceAuditEnvelope(
  envelope: VoiceAuditEnvelope,
  checksum: string,
): string {
  const lines = [
    `📜 Voice Audit Envelope`,
    `• trace ID: ${envelope.traceId}`,
    `• lineage complete: ${envelope.lineage.isComplete ? "yes" : "no"}`,
    `• lineage sealed: ${envelope.lineage.isSealed ? "yes" : "no"}`,
    `• effect status: ${envelope.effect.status}`,
    `• effect confirmed: ${envelope.effect.isAnchor ? "yes" : "no"}`,
    `• envelope valid: ${envelope.isValid ? "yes" : "no"}`,
    `• checksum: ${checksum.slice(0, 16)}…`,
    `• anchors: ${envelope.anchors.length}`,
    `• artifacts: ${envelope.artifacts.length}`,
    `• governance mode: ${envelope.governance.decisionMode}`,
  ];

  return lines.join("\n");
}
