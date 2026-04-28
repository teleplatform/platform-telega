// ─────────────────────────────────────────────────────────────
// ALICE TRUST / SAFETY CONVERSATION GUARDRAILS PACK v1.0 — Safe Mode
//
// Bounded safe mode decisions.
// Modes: none, bounded_answer, clarify_only, refuse_only, handoff_safe
// ─────────────────────────────────────────────────────────────

import type { AliceSafeModeDecision, AliceConversationRiskClass } from "./types.js";

export function buildAliceSafeModeDecision(input: {
  riskClass: AliceConversationRiskClass;
  escalationRequired?: boolean;
}): AliceSafeModeDecision {
  const riskClass = input.riskClass;
  const escalationRequired = input.escalationRequired ?? false;

  switch (riskClass) {
    case "safe":
      return {
        activate: false,
        mode: "none",
        reason: "No safe mode needed — normal operation allowed",
      };

    case "sensitive":
      return {
        activate: true,
        mode: "bounded_answer",
        reason: "Sensitive content — bounded response mode activated",
        notes: ["Provide limited, careful response"],
      };

    case "unsafe":
      return {
        activate: true,
        mode: "refuse_only",
        reason: "Unsafe content — refuse-only mode activated",
        notes: ["No answer allowed — refusal only"],
      };

    case "high_risk":
      return {
        activate: true,
        mode: escalationRequired ? "handoff_safe" : "refuse_only",
        reason: "High risk content — safe mode activated",
        notes: escalationRequired
          ? ["Handoff to safe channel recommended"]
          : ["Strict refusal mode — no answer allowed"],
      };

    case "unknown":
      return {
        activate: true,
        mode: "clarify_only",
        reason: "Unknown risk — clarify-only mode activated",
        notes: ["Seek clarification before proceeding"],
      };

    default:
      return {
        activate: true,
        mode: "handoff_safe",
        reason: `Unknown risk class: ${riskClass} — defaulting to handoff safe mode`,
      };
  }
}

export function getSafeModeDescription(mode: AliceSafeModeDecision["mode"]): string {
  switch (mode) {
    case "none":
      return "No safe mode — normal conversational operation";
    case "bounded_answer":
      return "Bounded answer mode — limited, careful response within safety boundaries";
    case "clarify_only":
      return "Clarify-only mode — seeking clarification before proceeding";
    case "refuse_only":
      return "Refuse-only mode — no answer allowed, only safe refusal";
    case "handoff_safe":
      return "Safe handoff mode — escalating to safer channel or operator";
    default:
      return `Unknown safe mode: ${mode}`;
  }
}
