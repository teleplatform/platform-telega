// ─────────────────────────────────────────────────────────────
// MULTILINGUAL LANGUAGE PACK CONTRACT v1.0 — Safe Degradation
//
// SAFE DEGRADATION LAW:
// uncertain language behavior must degrade safely
//
// If language is not confident about:
// - intent
// - entity extraction
// - protected action
// - voice readiness
// - surface readiness
//
// System MUST:
// - clarify
// - go to safe text fallback
// - limit capability
// - switch language/channel
// - not perform risky action
// ─────────────────────────────────────────────────────────────

import type { SafeDegradationInput, SafeDegradationResult, LanguagePack } from "./types.js";
import { SafeDegradationRequiredError } from "./errors.js";

export function computeSafeDegradation(
  input: SafeDegradationInput,
  pack?: LanguagePack,
): SafeDegradationResult {
  const fallbackLanguage = input.fallbackLanguage ?? "en";

  switch (input.uncertaintyType) {
    case "intent":
      return {
        action: "clarify",
        targetLanguage: input.languageCode,
        reason: `Uncertain intent in ${input.languageCode}. Asking for clarification.`,
        message: pack?.ux.clarifications?.["uncertain_intent"] ?? "I'm not sure I understood correctly. Could you rephrase?",
      };

    case "entity":
      return {
        action: "clarify",
        targetLanguage: input.languageCode,
        reason: `Uncertain entity extraction in ${input.languageCode}. Asking for clarification.`,
        message: pack?.ux.clarifications?.["uncertain_entity"] ?? "Could you provide more details?",
      };

    case "protected_action":
      return {
        action: "decline_action",
        targetLanguage: fallbackLanguage,
        reason: `Protected action not confident in ${input.languageCode}. Falling back to ${fallbackLanguage}.`,
        message: pack?.ux.errors?.["protected_action_fallback"] ?? "For safety, I need to respond in English for this action.",
      };

    case "voice_not_ready":
      return {
        action: "safe_text_fallback",
        targetLanguage: input.languageCode,
        reason: `Voice not ready for ${input.languageCode} on ${input.surface}. Falling back to text.`,
        message: pack?.ux.errors?.["voice_not_ready"] ?? "Voice is not available for this language. Responding in text.",
      };

    case "surface_not_ready":
      return {
        action: "switch_channel",
        targetLanguage: fallbackLanguage,
        reason: `Surface ${input.surface} not ready for ${input.languageCode}. Switching to ${fallbackLanguage}.`,
        message: pack?.ux.errors?.["surface_not_ready"] ?? `This feature is not available in ${input.languageCode} yet.`,
      };

    default:
      throw new SafeDegradationRequiredError(input.uncertaintyType, input.languageCode);
  }
}

export function assertSafeDegradationApplied(
  input: SafeDegradationInput,
  result: SafeDegradationResult,
): void {
  if (!result.action) {
    throw new SafeDegradationRequiredError(input.uncertaintyType, input.languageCode);
  }

  const validActions: SafeDegradationResult["action"][] = [
    "clarify",
    "safe_text_fallback",
    "limit_capability",
    "switch_language",
    "switch_channel",
    "decline_action",
  ];

  if (!validActions.includes(result.action)) {
    throw new SafeDegradationRequiredError(
      `Invalid degradation action: ${result.action}`,
      input.languageCode,
    );
  }
}

export function getDegradationDescription(action: SafeDegradationResult["action"]): string {
  switch (action) {
    case "clarify":
      return "Asking user for clarification";
    case "safe_text_fallback":
      return "Falling back to text response";
    case "limit_capability":
      return "Limiting available actions";
    case "switch_language":
      return "Switching to fallback language";
    case "switch_channel":
      return "Switching communication channel";
    case "decline_action":
      return "Declining action for safety";
    default:
      return `Unknown degradation action: ${action}`;
  }
}
