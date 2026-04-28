// ─────────────────────────────────────────────────────────────
// ARISHA MEMORY / PERSONALIZATION TRUST LAYER v1.0 — Continuity
//
// Bounded continuity layer.
// System can carry over: topic, workflow, preference, style.
// Only when it genuinely helps the conversation.
// ─────────────────────────────────────────────────────────────

import type { ArishaContinuityDecision, ArishaMemoryBoundaryDecision, ArishaMemoryContext } from "./types.js";

export function buildArishaContinuityDecision(input: {
  boundary: ArishaMemoryBoundaryDecision;
  memoryContext: ArishaMemoryContext;
  topicChanged?: boolean;
}): ArishaContinuityDecision {
  const boundary = input.boundary;
  const ctx = input.memoryContext;
  const topicChanged = input.topicChanged ?? false;

  // No memory → no continuity
  if (!boundary.mayUseMemory || boundary.mode === "none") {
    return {
      shouldCarryContinuity: false,
      continuityType: "none",
      reason: "Memory boundary does not allow continuity",
    };
  }

  // Continuity only mode → use topic continuity internally
  if (boundary.mode === "continuity_only") {
    return {
      shouldCarryContinuity: true,
      continuityType: "topic_continuity",
      reason: "Continuity-only mode — maintaining topic flow internally",
      notes: ["Do not explicitly reference past turns"],
    };
  }

  // Topic changed → don't carry over old topic
  if (topicChanged) {
    return {
      shouldCarryContinuity: false,
      continuityType: "none",
      reason: "Topic has changed — not carrying over old continuity",
      notes: ["Start fresh with new topic"],
    };
  }

  // Has history → carry topic/workflow continuity
  if (ctx.hasHistory && ctx.conversationTurns > 1) {
    return {
      shouldCarryContinuity: true,
      continuityType: "topic_continuity",
      reason: "Active conversation — maintaining topic continuity",
      notes: ["Natural flow from previous turns"],
    };
  }

  // Has preferences → preference continuity
  if (ctx.hasPreferences) {
    return {
      shouldCarryContinuity: true,
      continuityType: "preference_continuity",
      reason: "Preferences available — maintaining preference continuity",
      notes: ["Subtly apply known preferences"],
    };
  }

  // Nothing to carry
  return {
    shouldCarryContinuity: false,
    continuityType: "none",
    reason: "No continuity to carry over",
  };
}

export function getContinuityTypeDescription(type: ArishaContinuityDecision["continuityType"]): string {
  switch (type) {
    case "none":
      return "No continuity — fresh start for this turn";
    case "topic_continuity":
      return "Topic continuity — maintaining conversation topic flow";
    case "workflow_continuity":
      return "Workflow continuity — maintaining multi-step workflow progress";
    case "preference_continuity":
      return "Preference continuity — subtly applying known user preferences";
    case "style_continuity":
      return "Style continuity — maintaining established interaction style";
    default:
      return `Unknown continuity type: ${type}`;
  }
}
