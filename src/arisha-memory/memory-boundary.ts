// ─────────────────────────────────────────────────────────────
// ARISHA MEMORY / PERSONALIZATION TRUST LAYER v1.0 — Memory Boundary
//
// Decides whether memory may be used at all.
// Modes: none, minimal, contextual, continuity_only
// This is the FIRST gate — if boundary says no, nothing else matters.
// ─────────────────────────────────────────────────────────────

import type { ArishaMemoryBoundaryDecision, ArishaMemoryContext } from "./types.js";

export function buildArishaMemoryBoundaryDecision(input: {
  memoryContext: ArishaMemoryContext;
  currentTopicSensitive?: boolean;
}): ArishaMemoryBoundaryDecision {
  const ctx = input.memoryContext;
  const topicSensitive = input.currentTopicSensitive ?? false;

  // Safety escalation active → no memory use
  if (ctx.safetyEscalationActive) {
    return {
      mayUseMemory: false,
      mode: "none",
      reason: "Safety escalation active — memory use suspended",
      notes: ["Safety takes precedence over personalization"],
    };
  }

  // Sensitive context present → no memory use
  if (topicSensitive || ctx.sensitiveContextPresent) {
    return {
      mayUseMemory: false,
      mode: "none",
      reason: "Sensitive topic detected — memory use suspended",
      notes: ["Do not use memory during sensitive conversations"],
    };
  }

  // No memory at all → none
  if (!ctx.hasPreferences && !ctx.hasHistory) {
    return {
      mayUseMemory: false,
      mode: "none",
      reason: "No memory available",
    };
  }

  // Very first turns → minimal (don't over-personalize immediately)
  if (ctx.conversationTurns <= 2) {
    return {
      mayUseMemory: true,
      mode: "minimal",
      reason: "Early conversation — minimal memory use",
      notes: ["Avoid appearing too familiar too quickly"],
    };
  }

  // Long dormant → continuity_only (don't surface old memory explicitly)
  if (ctx.lastActiveTurnsAgo > 10) {
    return {
      mayUseMemory: true,
      mode: "continuity_only",
      reason: "Long dormant period — continuity only, no explicit memory surfacing",
      notes: ["Use memory for internal continuity, not explicit recall"],
    };
  }

  // Normal conversation → contextual
  return {
    mayUseMemory: true,
    mode: "contextual",
    reason: "Normal conversation — contextual memory use allowed",
    notes: ["Use memory when helpful and appropriate"],
  };
}

export function getBoundaryModeDescription(mode: ArishaMemoryBoundaryDecision["mode"]): string {
  switch (mode) {
    case "none":
      return "No memory use — safety or sensitivity requires memory suspension";
    case "minimal":
      return "Minimal memory use — avoid over-familiarity, use only essential context";
    case "contextual":
      return "Contextual memory use — use memory when helpful and appropriate";
    case "continuity_only":
      return "Continuity only — use memory internally for consistency, don't surface explicitly";
    default:
      return `Unknown boundary mode: ${mode}`;
  }
}
