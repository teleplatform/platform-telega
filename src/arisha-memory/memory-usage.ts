// ─────────────────────────────────────────────────────────────
// ARISHA MEMORY / PERSONALIZATION TRUST LAYER v1.0 — Memory Usage
//
// Decides HOW memory should be used (if boundary allows).
// Types: none, preference, tone, continuity, context_hint
// Not every memory is equally safe and appropriate in live conversation.
// ─────────────────────────────────────────────────────────────

import type { ArishaMemoryUsageDecision, ArishaMemoryBoundaryDecision, ArishaMemoryContext } from "./types.js";

export function buildArishaMemoryUsageDecision(input: {
  boundary: ArishaMemoryBoundaryDecision;
  memoryContext: ArishaMemoryContext;
  userRequestedPersonalization?: boolean;
}): ArishaMemoryUsageDecision {
  const boundary = input.boundary;
  const ctx = input.memoryContext;

  // Boundary says no → no usage
  if (!boundary.mayUseMemory) {
    return {
      shouldUse: false,
      usageType: "none",
      reason: "Memory boundary does not allow memory use",
    };
  }

  // None mode → no usage
  if (boundary.mode === "none") {
    return {
      shouldUse: false,
      usageType: "none",
      reason: "Memory boundary mode is none",
    };
  }

  // Continuity only → continuity usage, no explicit surfacing
  if (boundary.mode === "continuity_only") {
    return {
      shouldUse: true,
      usageType: "continuity",
      reason: "Continuity-only mode — use memory for internal consistency",
      notes: ["Do not explicitly reference memory in response"],
    };
  }

  // Minimal → preference only, avoid tone/style adaptation
  if (boundary.mode === "minimal") {
    return {
      shouldUse: true,
      usageType: "preference",
      reason: "Minimal mode — use only essential preferences",
      notes: ["Avoid tone/style adaptation in early conversation"],
    };
  }

  // Contextual → full usage based on what's available
  if (boundary.mode === "contextual") {
    // If user requested personalization, use preference + tone
    if (input.userRequestedPersonalization) {
      return {
        shouldUse: true,
        usageType: "preference",
        reason: "User requested personalization — using preference memory",
        notes: ["User explicitly invited personalization"],
      };
    }

    // If preferences exist, use them
    if (ctx.hasPreferences) {
      return {
        shouldUse: true,
        usageType: "preference",
        reason: "Preferences available — using preference memory",
      };
    }

    // If history exists, use continuity
    if (ctx.hasHistory) {
      return {
        shouldUse: true,
        usageType: "continuity",
        reason: "Conversation history available — using continuity",
      };
    }

    // Nothing available
    return {
      shouldUse: false,
      usageType: "none",
      reason: "No usable memory available",
    };
  }

  // Default: no usage
  return {
    shouldUse: false,
    usageType: "none",
    reason: "Boundary mode does not allow memory use",
  };
}

export function getUsageTypeDescription(usageType: ArishaMemoryUsageDecision["usageType"]): string {
  switch (usageType) {
    case "none":
      return "No memory usage — memory not used in this response";
    case "preference":
      return "Preference usage — applying known user preferences subtly";
    case "tone":
      return "Tone usage — adapting response tone based on memory";
    case "continuity":
      return "Continuity usage — maintaining conversation flow based on history";
    case "context_hint":
      return "Context hint usage — using memory as internal context hint";
    default:
      return `Unknown usage type: ${usageType}`;
  }
}
