// ─────────────────────────────────────────────────────────────
// MULTILINGUAL LANGUAGE PACK CONTRACT v1.0 — Persona Tone Pack
//
// ONE persona — different languages — unified character
// Language can change expression, but NOT:
// - character
// - warmth
// - core reasoning stance
// - creator/user split
// - safety posture
// ─────────────────────────────────────────────────────────────

import type { LanguagePersonaPack } from "./types.js";
import { PersonaConsistencyError, LanguagePackInvalidError } from "./errors.js";

const VALID_PERSONA_IDS = new Set(["arisha"] as const);

export function buildPersonaPack(input: {
  personaId: LanguagePersonaPack["personaId"];
  toneClassByMode: LanguagePersonaPack["toneClassByMode"];
  forbiddenTonePatterns?: string[];
  consistencyNotes?: string[];
}): LanguagePersonaPack {
  if (!VALID_PERSONA_IDS.has(input.personaId)) {
    throw new LanguagePackInvalidError(
      `Invalid personaId: ${input.personaId}. Must be one of: ${Array.from(VALID_PERSONA_IDS).join(", ")}`,
    );
  }
  if (!input.toneClassByMode) {
    throw new LanguagePackInvalidError("toneClassByMode is required");
  }
  if (!input.toneClassByMode.creator) {
    throw new LanguagePackInvalidError("toneClassByMode.creator is required");
  }
  if (!input.toneClassByMode.user) {
    throw new LanguagePackInvalidError("toneClassByMode.user is required");
  }
  if (!input.toneClassByMode.neutral) {
    throw new LanguagePackInvalidError("toneClassByMode.neutral is required");
  }

  return {
    personaId: input.personaId,
    toneClassByMode: input.toneClassByMode,
    forbiddenTonePatterns: input.forbiddenTonePatterns,
    consistencyNotes: input.consistencyNotes,
  };
}

export function validatePersonaPack(persona: LanguagePersonaPack): string[] {
  const errors: string[] = [];

  if (!VALID_PERSONA_IDS.has(persona.personaId)) {
    errors.push(`Invalid personaId: ${persona.personaId}`);
  }
  if (!persona.toneClassByMode) {
    errors.push("toneClassByMode is required");
  } else {
    if (!persona.toneClassByMode.creator) errors.push("toneClassByMode.creator is required");
    if (!persona.toneClassByMode.user) errors.push("toneClassByMode.user is required");
    if (!persona.toneClassByMode.neutral) errors.push("toneClassByMode.neutral is required");
  }

  return errors;
}

export function checkPersonaConsistency(
  pack: LanguagePersonaPack,
  referencePack: LanguagePersonaPack,
): string[] {
  const violations: string[] = [];

  // Persona ID must match (one persona across all languages)
  if (pack.personaId !== referencePack.personaId) {
    violations.push(
      `personaId mismatch: ${pack.personaId} vs ${referencePack.personaId}. One persona across all languages.`,
    );
  }

  // Check that tone classes are semantically similar (not identical strings, but same concept)
  // This is a structural check — actual semantic validation would require NLP
  const modeKeys = Object.keys(referencePack.toneClassByMode) as Array<keyof typeof referencePack.toneClassByMode>;
  for (const mode of modeKeys) {
    if (!pack.toneClassByMode[mode]) {
      violations.push(`Missing tone class for mode: ${mode}`);
    }
  }

  // Check forbidden patterns
  if (pack.forbiddenTonePatterns) {
    for (const pattern of pack.forbiddenTonePatterns) {
      if (!pattern || pattern.trim() === "") {
        violations.push("Empty forbiddenTonePattern found");
      }
    }
  }

  return violations;
}
