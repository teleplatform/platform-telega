// ─────────────────────────────────────────────────────────────
// ARISHA MEMORY / PERSONALIZATION TRUST LAYER v1.0 — Safety Precedence
//
// Personalization must remain subordinate to safety and trust boundaries.
// If safety/trust escalation is active, personalization is suspended.
// ─────────────────────────────────────────────────────────────

import type { ArishaMemoryContext } from "./types.js";

export function enforceMemoryTrustSafetyBoundary(input: {
  memoryContext: ArishaMemoryContext;
  safetyEscalationActive?: boolean;
  trustBoundaryActive?: boolean;
  refusalActive?: boolean;
}): { personalizationAllowed: boolean; reason: string } {
  const ctx = input.memoryContext;
  const safetyEscalation = input.safetyEscalationActive ?? ctx.safetyEscalationActive;
  const trustBoundary = input.trustBoundaryActive ?? false;
  const refusalActive = input.refusalActive ?? false;

  // Safety escalation active → no personalization
  if (safetyEscalation) {
    return {
      personalizationAllowed: false,
      reason: "Safety escalation active — personalization suspended",
    };
  }

  // Trust boundary active → no personalization
  if (trustBoundary) {
    return {
      personalizationAllowed: false,
      reason: "Trust boundary active — personalization suspended",
    };
  }

  // Refusal path active → no personalization (don't soften safety response)
  if (refusalActive) {
    return {
      personalizationAllowed: false,
      reason: "Refusal path active — personalization must not soften safety response",
    };
  }

  // Sensitive context present → no personalization
  if (ctx.sensitiveContextPresent) {
    return {
      personalizationAllowed: false,
      reason: "Sensitive context present — personalization suspended",
    };
  }

  // All clear — personalization allowed
  return {
    personalizationAllowed: true,
    reason: "Safety and trust boundaries clear — personalization allowed",
  };
}

export function getSafetyPrecedenceDescription(): string {
  return "Personalization is always subordinate to safety and trust boundaries. " +
    "When safety escalation, trust boundaries, refusal paths, or sensitive contexts are active, " +
    "personalization is suspended until the situation resolves.";
}
