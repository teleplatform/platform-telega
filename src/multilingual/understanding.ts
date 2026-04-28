// ─────────────────────────────────────────────────────────────
// MULTILINGUAL LANGUAGE PACK CONTRACT v1.0 — Understanding Profile
// ─────────────────────────────────────────────────────────────

import type { LanguageUnderstandingProfile } from "./types.js";
import { LanguagePackInvalidError } from "./errors.js";

const VALID_ENTITY_BEHAVIORS = new Set(["strict", "moderate", "limited"] as const);
const VALID_AMBIGUITY_POLICIES = new Set(["clarify", "safe_fallback"] as const);
const VALID_PROTECTED_INTENT = new Set(["deny_or_clarify"] as const);

export function buildUnderstandingProfile(input: {
  intentMappingsVersion: string;
  entityBehavior: LanguageUnderstandingProfile["entityBehavior"];
  ambiguityPolicy: LanguageUnderstandingProfile["ambiguityPolicy"];
  protectedIntentHandling: LanguageUnderstandingProfile["protectedIntentHandling"];
  localeHints?: string[];
}): LanguageUnderstandingProfile {
  if (!input.intentMappingsVersion || input.intentMappingsVersion.trim() === "") {
    throw new LanguagePackInvalidError("intentMappingsVersion is required");
  }
  if (!VALID_ENTITY_BEHAVIORS.has(input.entityBehavior)) {
    throw new LanguagePackInvalidError(
      `Invalid entityBehavior: ${input.entityBehavior}. Must be one of: ${Array.from(VALID_ENTITY_BEHAVIORS).join(", ")}`,
    );
  }
  if (!VALID_AMBIGUITY_POLICIES.has(input.ambiguityPolicy)) {
    throw new LanguagePackInvalidError(
      `Invalid ambiguityPolicy: ${input.ambiguityPolicy}. Must be one of: ${Array.from(VALID_AMBIGUITY_POLICIES).join(", ")}`,
    );
  }
  if (!VALID_PROTECTED_INTENT.has(input.protectedIntentHandling)) {
    throw new LanguagePackInvalidError(
      `Invalid protectedIntentHandling: ${input.protectedIntentHandling}. Must be one of: ${Array.from(VALID_PROTECTED_INTENT).join(", ")}`,
    );
  }

  return {
    intentMappingsVersion: input.intentMappingsVersion,
    entityBehavior: input.entityBehavior,
    ambiguityPolicy: input.ambiguityPolicy,
    protectedIntentHandling: input.protectedIntentHandling,
    localeHints: input.localeHints,
  };
}

export function validateUnderstandingProfile(profile: LanguageUnderstandingProfile): string[] {
  const errors: string[] = [];

  if (!profile.intentMappingsVersion) errors.push("intentMappingsVersion is required");
  if (!VALID_ENTITY_BEHAVIORS.has(profile.entityBehavior)) errors.push(`Invalid entityBehavior: ${profile.entityBehavior}`);
  if (!VALID_AMBIGUITY_POLICIES.has(profile.ambiguityPolicy)) errors.push(`Invalid ambiguityPolicy: ${profile.ambiguityPolicy}`);
  if (!VALID_PROTECTED_INTENT.has(profile.protectedIntentHandling)) errors.push(`Invalid protectedIntentHandling: ${profile.protectedIntentHandling}`);

  return errors;
}
