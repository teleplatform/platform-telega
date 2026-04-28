// ─────────────────────────────────────────────────────────────
// ALICE TRUST / SAFETY CONVERSATION GUARDRAILS PACK v1.0 — Trust Boundaries
//
// Bounded trust boundary decisions.
// Modes: normal, bounded, refusal, safe_mode
// ─────────────────────────────────────────────────────────────

import type { AliceTrustBoundaryDecision, AliceConversationRiskClass } from "./types.js";

export function buildAliceTrustBoundaryDecision(input: {
  riskClass: AliceConversationRiskClass;
  contextSafe?: boolean;
}): AliceTrustBoundaryDecision {
  const riskClass = input.riskClass;

  switch (riskClass) {
    case "safe":
      return {
        accepted: true,
        boundaryMode: "normal",
        reason: "No risk detected — normal conversational boundary",
      };

    case "sensitive":
      return {
        accepted: true,
        boundaryMode: "bounded",
        reason: "Sensitive content detected — conversational boundary limited",
        notes: ["Response should be bounded and careful"],
      };

    case "unsafe":
      return {
        accepted: false,
        boundaryMode: "refusal",
        reason: "Unsafe content detected — refusal boundary activated",
        notes: ["Refusal required — do not fulfill request"],
      };

    case "high_risk":
      return {
        accepted: false,
        boundaryMode: "safe_mode",
        reason: "High risk content detected — safe mode boundary activated",
        notes: ["Immediate safety intervention required"],
      };

    case "unknown":
      return {
        accepted: true,
        boundaryMode: "bounded",
        reason: "Risk indeterminate — defaulting to bounded boundary",
        notes: ["Treat as sensitive until clarified"],
      };

    default:
      return {
        accepted: false,
        boundaryMode: "safe_mode",
        reason: `Unknown risk class: ${riskClass} — defaulting to safe mode`,
      };
  }
}

export function getBoundaryModeDescription(mode: AliceTrustBoundaryDecision["boundaryMode"]): string {
  switch (mode) {
    case "normal":
      return "Normal boundary — full conversational freedom within standard limits";
    case "bounded":
      return "Bounded boundary — limited response range, careful handling required";
    case "refusal":
      return "Refusal boundary — request cannot be fulfilled, refusal required";
    case "safe_mode":
      return "Safe mode boundary — immediate safety intervention, strict limits";
    default:
      return `Unknown boundary mode: ${mode}`;
  }
}
