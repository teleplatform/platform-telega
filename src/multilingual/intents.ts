// ─────────────────────────────────────────────────────────────
// MULTILINGUAL LANGUAGE PACK CONTRACT v1.0 — Intent Mappings
//
// Expands language-specific intent understanding WITHOUT creating
// new policy or changing core intent law.
// Intent mappings extend recognition; they don't rewrite safety.
// ─────────────────────────────────────────────────────────────

import type { LanguageIntentMappings } from "./types.js";
import { LanguagePackInvalidError } from "./errors.js";

export function buildIntentMappings(input: {
  version: string;
  intents: LanguageIntentMappings["intents"];
}): LanguageIntentMappings {
  if (!input.version || input.version.trim() === "") {
    throw new LanguagePackInvalidError("intent mappings version is required");
  }
  if (!input.intents || input.intents.length === 0) {
    throw new LanguagePackInvalidError("intents list is required and must not be empty");
  }

  for (let i = 0; i < input.intents.length; i++) {
    const intent = input.intents[i];
    if (!intent.coreIntentId || intent.coreIntentId.trim() === "") {
      throw new LanguagePackInvalidError(`intent[${i}].coreIntentId is required`);
    }
    if (!intent.examples || intent.examples.length === 0) {
      throw new LanguagePackInvalidError(`intent[${i}].examples is required and must not be empty`);
    }
  }

  return {
    version: input.version,
    intents: input.intents,
  };
}

export function validateIntentMappings(mappings: LanguageIntentMappings): string[] {
  const errors: string[] = [];

  if (!mappings.version) errors.push("intent mappings version is required");
  if (!mappings.intents || mappings.intents.length === 0) errors.push("intents list is required and must not be empty");

  for (let i = 0; i < (mappings.intents || []).length; i++) {
    const intent = mappings.intents[i];
    if (!intent.coreIntentId) errors.push(`intent[${i}].coreIntentId is required`);
    if (!intent.examples || intent.examples.length === 0) errors.push(`intent[${i}].examples is required and must not be empty`);
  }

  return errors;
}

export function findIntentByCoreId(mappings: LanguageIntentMappings, coreIntentId: string): LanguageIntentMappings["intents"][number] | undefined {
  return mappings.intents.find((i) => i.coreIntentId === coreIntentId);
}

export function findIntentByExample(mappings: LanguageIntentMappings, example: string): LanguageIntentMappings["intents"][number] | undefined {
  return mappings.intents.find((intent) =>
    intent.examples.some((e) => e.toLowerCase().includes(example.toLowerCase())),
  );
}

export function getProtectedIntents(mappings: LanguageIntentMappings): LanguageIntentMappings["intents"] {
  return mappings.intents.filter((i) => i.protected === true);
}
