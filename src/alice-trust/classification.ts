// ─────────────────────────────────────────────────────────────
// ALICE TRUST / SAFETY CONVERSATION GUARDRAILS PACK v1.0 — Risk Classification
//
// Bounded conversational risk classification.
// Levels: safe, sensitive, unsafe, high_risk, unknown
// ─────────────────────────────────────────────────────────────

import type { AliceConversationRiskClass, AliceSensitiveIntentDecision } from "./types.js";
import { detectAliceSensitiveIntent } from "./sensitive.js";

export function classifyAliceConversationRisk(input: {
  utterance: string;
  contextHints?: string[];
}): { riskClass: AliceConversationRiskClass; sensitiveIntent: AliceSensitiveIntentDecision } {
  const utterance = input.utterance.toLowerCase();
  const contextHints = input.contextHints ?? [];
  const fullContext = [utterance, ...contextHints].join(" ").toLowerCase();

  // 1. Detect sensitive intent first
  const sensitiveIntent = detectAliceSensitiveIntent({ utterance: input.utterance, contextHints });

  // 2. If sensitive intent detected with boundary requirement, classify accordingly
  if (sensitiveIntent.detected && sensitiveIntent.requiresBoundary) {
    switch (sensitiveIntent.category) {
      case "self_harm":
      case "violence":
        return { riskClass: "high_risk", sensitiveIntent };
      case "illegal":
      case "sexual":
      case "manipulation":
        return { riskClass: "unsafe", sensitiveIntent };
      case "privacy":
      case "medical":
        return { riskClass: "sensitive", sensitiveIntent };
      default:
        return { riskClass: "sensitive", sensitiveIntent };
    }
  }

  // 3. Check for known unsafe patterns (bounded v1 keyword/pattern matching)
  const unsafePatterns = [
    /как (сделать|изготовить|создать).*(бомбу|оружие|яд)/i,
    /как (убить|ранить|навредить)/i,
    /помоги (украсть|взломать|обмануть)/i,
  ];

  for (const pattern of unsafePatterns) {
    if (pattern.test(fullContext)) {
      return { riskClass: "high_risk", sensitiveIntent };
    }
  }

  // 4. Check for sensitive patterns
  const sensitivePatterns = [
    /как (лечить|диагностировать|принимать (лекарств|препарат))/i,
    /(мне (плохо|страшно|одиноко|тяжело))/i,
    /(расскажи про (личн|приватн))/i,
  ];

  for (const pattern of sensitivePatterns) {
    if (pattern.test(fullContext)) {
      return { riskClass: "sensitive", sensitiveIntent };
    }
  }

  // 5. Default to safe
  return { riskClass: "safe", sensitiveIntent };
}

export function getRiskClassDescription(riskClass: AliceConversationRiskClass): string {
  switch (riskClass) {
    case "safe":
      return "Safe — no conversational risk detected, normal processing allowed";
    case "sensitive":
      return "Sensitive — bounded response recommended, user may need careful handling";
    case "unsafe":
      return "Unsafe — conversational boundary violation, refusal or redirect required";
    case "high_risk":
      return "High risk — immediate safety intervention required, strict refusal or handoff";
    case "unknown":
      return "Unknown — risk indeterminate, treat as sensitive until clarified";
    default:
      return `Unknown risk class: ${riskClass}`;
  }
}
