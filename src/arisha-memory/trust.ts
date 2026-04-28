// ─────────────────────────────────────────────────────────────
// ARISHA MEMORY / PERSONALIZATION TRUST LAYER v1.0 — Trust Preservation
//
// Ensures memory use preserves trust, doesn't become creepy.
// "Помню, но не пугаю" — remember, but don't scare.
// Helpful continuity > explicit memory flex.
// ─────────────────────────────────────────────────────────────

import type {
  ArishaMemoryBoundaryDecision,
  ArishaMemoryUsageDecision,
  ArishaContinuityDecision,
  ArishaToneAdaptationDecision,
} from "./types.js";

export function preserveArishaMemoryTrustBehavior(input: {
  boundary: ArishaMemoryBoundaryDecision;
  usage: ArishaMemoryUsageDecision;
  continuity: ArishaContinuityDecision;
  toneAdaptation: ArishaToneAdaptationDecision;
}): { trustPreserved: boolean; guidance: string } {
  const { boundary, usage, continuity, toneAdaptation } = input;

  // If boundary says no memory use, trust is preserved by default
  if (!boundary.mayUseMemory || boundary.mode === "none") {
    return {
      trustPreserved: true,
      guidance: "Memory suspended — trust boundary maintained",
    };
  }

  // Check for potential trust violations
  const violations: string[] = [];

  // Violation: usage says yes but boundary says minimal — over-using
  if (usage.shouldUse && boundary.mode === "minimal" && usage.usageType !== "preference") {
    violations.push("Over-using memory in minimal mode — should only use preferences");
  }

  // Violation: continuity is high but boundary is continuity_only — explicit surfacing
  if (continuity.shouldCarryContinuity && boundary.mode === "continuity_only" && continuity.continuityType !== "topic_continuity") {
    violations.push("Explicit memory surfacing in continuity_only mode");
  }

  // Violation: tone adapting heavily in early conversation
  if (toneAdaptation.shouldAdapt && toneAdaptation.adaptationType === "warm_up") {
    // This is generally OK if boundary allows, but note it
  }

  if (violations.length > 0) {
    return {
      trustPreserved: false,
      guidance: `Trust violations detected: ${violations.join("; ")}`,
    };
  }

  return {
    trustPreserved: true,
    guidance: "Memory use is within trust boundaries — helpful continuity maintained",
  };
}

export function getTrustPreservationGuidance(): string[] {
  return [
    "Never explicitly say 'I remember that you...' unless user invites it",
    "Use memory to inform response, not to showcase memory",
    "If unsure whether to use memory, don't",
    "Early conversation — avoid memory use entirely",
    "Sensitive topics — suspend memory use completely",
    "Safety contexts — personalization must never soften safety boundaries",
    "Continuity should feel natural, not like data retrieval",
    "One persona consistency — memory must not change Arisha's core personality",
  ];
}
