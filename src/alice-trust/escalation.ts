// ─────────────────────────────────────────────────────────────
// ALICE TRUST / SAFETY CONVERSATION GUARDRAILS PACK v1.0 — Escalation
//
// Bounded escalation paths:
// clarify_only, safe_mode, refusal, handoff_safe
// No full human escalation platform — just structured safety routing.
// ─────────────────────────────────────────────────────────────

import type { AliceSafetyEscalationPath, AliceConversationRiskClass, AliceRefusalDecision } from "./types.js";

export function resolveAliceSafetyEscalationPath(input: {
  riskClass: AliceConversationRiskClass;
  refusal: AliceRefusalDecision;
  repeatedTriggers?: number;
}): AliceSafetyEscalationPath {
  const riskClass = input.riskClass;
  const refusal = input.refusal;
  const repeatedTriggers = input.repeatedTriggers ?? 0;

  // High risk with repeated triggers → handoff
  if (riskClass === "high_risk" && repeatedTriggers >= 2) {
    return {
      escalationLevel: "handoff_safe",
      reason: "High risk with repeated triggers — escalating to safe handoff",
      notes: [`Repeated triggers: ${repeatedTriggers}`],
    };
  }

  // Safety block refusal → handoff
  if (refusal.refusalType === "safety_block") {
    return {
      escalationLevel: "handoff_safe",
      reason: "Safety block activated — handoff to safe channel",
    };
  }

  // High risk → refusal
  if (riskClass === "high_risk") {
    return {
      escalationLevel: "refusal",
      reason: "High risk detected — strict refusal required",
    };
  }

  // Unsafe → refusal
  if (riskClass === "unsafe") {
    return {
      escalationLevel: "refusal",
      reason: "Unsafe content detected — refusal activated",
    };
  }

  // Sensitive with refusal → safe_mode
  if (riskClass === "sensitive" && refusal.shouldRefuse) {
    return {
      escalationLevel: "safe_mode",
      reason: "Sensitive with refusal — entering safe mode",
    };
  }

  // Sensitive → clarify_only
  if (riskClass === "sensitive") {
    return {
      escalationLevel: "clarify_only",
      reason: "Sensitive content — seeking clarification",
    };
  }

  // Unknown → safe_mode
  if (riskClass === "unknown") {
    return {
      escalationLevel: "safe_mode",
      reason: "Unknown risk — defaulting to safe mode",
    };
  }

  // Safe → no escalation
  return {
    escalationLevel: "clarify_only", // Minimal escalation for safe content
    reason: "Safe content — no escalation needed",
  };
}

export function getEscalationDescription(level: AliceSafetyEscalationPath["escalationLevel"]): string {
  switch (level) {
    case "clarify_only":
      return "Clarify only — seeking user clarification, no intervention needed";
    case "safe_mode":
      return "Safe mode — entering bounded safety mode, limited responses";
    case "refusal":
      return "Refusal — strict boundary activated, no answer allowed";
    case "handoff_safe":
      return "Handoff safe — escalating to safer channel or operator";
    default:
      return `Unknown escalation level: ${level}`;
  }
}
