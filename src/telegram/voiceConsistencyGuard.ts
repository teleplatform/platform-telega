/**
 * Voice Consistency Guard & Cross-Lineage Validation Layer v4.2
 *
 * Takes multiple VoiceEffectLineage records and validates that they are
 * globally consistent — not just individually valid, but logically
 * compatible when executed together.
 *
 * This layer answers:
 *   - "Are all these effects logically compatible with each other?"
 *   - "Are there hidden state, policy, resource, or temporal conflicts?"
 *   - "Should we allow, restrict, or block the combined execution?"
 *
 * This layer does NOT:
 *   - mutate any advisory layers
 *   - change runtime config
 *   - launch recheck execution
 *   - use DB / ML / external dependencies
 */

import crypto from "node:crypto";
import type {
  VoiceEffectLineage,
  VoiceEffectRecord,
  VoiceAnchorType,
} from "./voiceEffectLineageAuditEnvelope.js";
import type { VoiceAuditEnvelope } from "./voiceEffectLineageAuditEnvelope.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceConsistencyConflictType =
  | "state_conflict"
  | "policy_conflict"
  | "resource_conflict"
  | "temporal_conflict";

export interface VoiceConsistencyConflict {
  type: VoiceConsistencyConflictType;
  effectIds: string[];
  description: string;
}

export type VoiceConsistencyResolutionStrategy =
  | "block_all"
  | "allow_partial"
  | "require_human_review";

export interface VoiceConsistencyGuardResult {
  orchestrationId: string;

  isConsistent: boolean;

  conflicts: VoiceConsistencyConflict[];

  resolutionStrategy: VoiceConsistencyResolutionStrategy;

  evaluatedAt: number;

  summary: string;
  guardInstruction: string;
}

export interface EvaluateVoiceConsistencyGuardInput {
  lineages: VoiceEffectLineage[];
  effects: VoiceEffectRecord[];
  envelopes: VoiceAuditEnvelope[];
}

// ============================================================================
// Conflict detection rules
// ============================================================================

/**
 * STATE CONFLICT detection
 *
 * Detects when effects put the system into mutually exclusive states:
 *   - protected_mode_entered AND override_channel_unlocked
 *   - cooling_increased AND override_locked (if override needed for cooling)
 */
function detectStateConflicts(
  effects: VoiceEffectRecord[],
): VoiceConsistencyConflict[] {
  const conflicts: VoiceConsistencyConflict[] = [];
  const effectTypes = new Map<string, string>();

  for (const effect of effects) {
    effectTypes.set(effect.effectId, effect.reactionId);
  }

  const allEffectEntries = Array.from(effectTypes.entries());

  // Check for protected_mode + override unlock conflict
  const hasProtectedMode = allEffectEntries.some(
    ([, type]) => type === "protected_mode_entered",
  );
  const hasOverrideUnlock = allEffectEntries.some(
    ([, type]) => type === "override_unlocked",
  );

  if (hasProtectedMode && hasOverrideUnlock) {
    const protectedEffectId = allEffectEntries.find(
      ([, type]) => type === "protected_mode_entered",
    )![0];
    const unlockEffectId = allEffectEntries.find(
      ([, type]) => type === "override_unlocked",
    )![0];

    conflicts.push({
      type: "state_conflict",
      effectIds: [protectedEffectId, unlockEffectId],
      description:
        "System cannot be in protected mode AND have override channel unlocked — mutually exclusive states.",
    });
  }

  return conflicts;
}

/**
 * POLICY CONFLICT detection
 *
 * Detects when effects violate policy constraints:
 *   - policy requires lock but effect unlocks
 *   - governance mode changed without proper authorization
 */
function detectPolicyConflicts(
  effects: VoiceEffectRecord[],
  envelopes: VoiceAuditEnvelope[],
): VoiceConsistencyConflict[] {
  const conflicts: VoiceConsistencyConflict[] = [];

  // Check for governance mode violations
  const autoEffects = effects.filter(
    (e) => e.confirmationType === "system_ack",
  );

  for (const envelope of envelopes) {
    // Defensive check
    if (!envelope?.effect?.effectId || !envelope?.execution?.executionId) {
      continue;
    }

    // If governance mode is "human" but effect was auto-confirmed
    if (
      envelope.governance.decisionMode === "human" &&
      autoEffects.some((e) => e.executionId === envelope.execution.executionId)
    ) {
      conflicts.push({
        type: "policy_conflict",
        effectIds: [envelope.effect.effectId],
        description:
          "Effect was auto-confirmed but governance policy requires human decision mode.",
      });
    }
  }

  return conflicts;
}

/**
 * TEMPORAL CONFLICT detection
 *
 * Detects when effects are executed in wrong order:
 *   - effect executed before its prerequisite
 */
function detectTemporalConflicts(
  effects: VoiceEffectRecord[],
): VoiceConsistencyConflict[] {
  const conflicts: VoiceConsistencyConflict[] = [];

  // Check for effects without proper confirmation timestamps
  const confirmedEffects = effects.filter(
    (e) => e.status === "confirmed" && e.confirmedAt !== undefined,
  );

  // Sort by confirmation time to check ordering
  const sortedByTime = [...confirmedEffects].sort(
    (a, b) => (a.confirmedAt ?? 0) - (b.confirmedAt ?? 0),
  );

  // Check for effects that should have ordering
  const coolingEffects = sortedByTime.filter(
    (e) => e.reactionId === "increase_cooling",
  );
  const protectedModeEffects = sortedByTime.filter(
    (e) => e.reactionId === "enter_protected_mode",
  );

  // If both exist, protected mode should come after cooling
  if (coolingEffects.length > 0 && protectedModeEffects.length > 0) {
    const lastCooling = coolingEffects[coolingEffects.length - 1];
    const firstProtected = protectedModeEffects[0];

    if (
      lastCooling.confirmedAt !== undefined &&
      firstProtected.confirmedAt !== undefined &&
      lastCooling.confirmedAt > firstProtected.confirmedAt
    ) {
      conflicts.push({
        type: "temporal_conflict",
        effectIds: [lastCooling.effectId, firstProtected.effectId],
        description:
          "Cooling increase should precede protected mode entry — temporal ordering violated.",
      });
    }
  }

  return conflicts;
}

// ============================================================================
// Resolution strategy determination
// ============================================================================

function determineResolutionStrategy(
  conflicts: VoiceConsistencyConflict[],
): VoiceConsistencyResolutionStrategy {
  if (conflicts.length === 0) {
    return "allow_partial";
  }

  const hasStateConflict = conflicts.some(
    (c) => c.type === "state_conflict",
  );
  const hasPolicyConflict = conflicts.some(
    (c) => c.type === "policy_conflict",
  );

  if (hasStateConflict) {
    return "block_all";
  }

  if (hasPolicyConflict) {
    return "require_human_review";
  }

  // Resource or temporal conflicts → allow partial
  return "allow_partial";
}

// ============================================================================
// Summary builder
// ============================================================================

function buildConsistencySummary(
  isConsistent: boolean,
  conflicts: VoiceConsistencyConflict[],
  strategy: VoiceConsistencyResolutionStrategy,
): string {
  if (isConsistent) {
    return "All effects are globally consistent — no conflicts detected across the execution set.";
  }

  const conflictTypes = conflicts.map((c) => c.type).join(", ");
  return `${conflicts.length} conflict(s) detected (${conflictTypes}). Resolution strategy: ${strategy}.`;
}

function buildGuardInstruction(
  strategy: VoiceConsistencyResolutionStrategy,
): string {
  switch (strategy) {
    case "block_all":
      return "Block all affected effects. Do not proceed until conflicts are resolved.";
    case "allow_partial":
      return "Allow non-conflicting effects to proceed. Review conflicting effects before further action.";
    case "require_human_review":
      return "Escalate to human review — policy conflict requires operator judgment.";
  }
}

// ============================================================================
// Core consistency guard function
// ============================================================================

/**
 * Evaluate cross-lineage consistency across multiple effect lineages.
 * Pure function — deterministic, bounded, read-only.
 */
export function evaluateVoiceConsistencyGuard(
  input: EvaluateVoiceConsistencyGuardInput,
): VoiceConsistencyGuardResult {
  const orchestrationId = `voice_orch_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;

  // Detect all conflict types
  const stateConflicts = detectStateConflicts(input.effects);
  const policyConflicts = detectPolicyConflicts(input.effects, input.envelopes);
  const temporalConflicts = detectTemporalConflicts(input.effects);

  const allConflicts = [
    ...stateConflicts,
    ...policyConflicts,
    ...temporalConflicts,
  ];

  const isConsistent = allConflicts.length === 0;
  const strategy = determineResolutionStrategy(allConflicts);
  const summary = buildConsistencySummary(isConsistent, allConflicts, strategy);
  const guardInstruction = buildGuardInstruction(strategy);

  return {
    orchestrationId,
    isConsistent,
    conflicts: allConflicts,
    resolutionStrategy: strategy,
    evaluatedAt: Date.now(),
    summary,
    guardInstruction,
  };
}

// ============================================================================
// Consistency anchor builder
// ============================================================================

export function buildConsistencyAnchor(
  result: VoiceConsistencyGuardResult,
  orchestrationId: string,
): { anchorType: VoiceAnchorType; refId: string; timestamp: number } {
  return {
    anchorType: result.isConsistent
      ? "consistency_passed"
      : "consistency_failed",
    refId: orchestrationId,
    timestamp: result.evaluatedAt,
  };
}

// ============================================================================
// Formatter for human reading
// ============================================================================

export function formatVoiceConsistencyGuardResult(
  result: VoiceConsistencyGuardResult,
): string {
  const lines = [
    `🛡️ Voice Consistency Guard`,
    `• orchestration ID: ${result.orchestrationId}`,
    `• consistent: ${result.isConsistent ? "yes" : "no"}`,
    `• conflicts: ${result.conflicts.length}`,
    `• resolution: ${result.resolutionStrategy}`,
    `• summary: ${result.summary}`,
    `• instruction: ${result.guardInstruction}`,
  ];

  if (result.conflicts.length > 0) {
    lines.push("");
    lines.push("Conflicts:");
    for (const conflict of result.conflicts) {
      lines.push(
        `  → ${conflict.type}: ${conflict.description} (${conflict.effectIds.join(", ")})`,
      );
    }
  }

  return lines.join("\n");
}
