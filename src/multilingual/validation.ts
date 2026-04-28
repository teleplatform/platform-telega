// ─────────────────────────────────────────────────────────────
// MULTILINGUAL LANGUAGE PACK CONTRACT v1.0 — Validation Pack
// ─────────────────────────────────────────────────────────────

import type { LanguageValidationPack } from "./types.js";
import type { LanguagePack } from "./types.js";
import { LanguagePackValidationFailedError, PersonaConsistencyError } from "./errors.js";
import { validateManifest } from "./manifest.js";
import { validateUnderstandingProfile } from "./understanding.js";
import { validateUxPack } from "./ux.js";
import { validatePersonaPack } from "./persona.js";
import { validateVoicePack } from "./voice.js";

const REQUIRED_TESTS = [
  "intent_understanding_tests",
  "entity_handling_tests",
  "safe_fallback_tests",
  "protected_action_tests",
  "persona_consistency_checks",
  "surface_compatibility_checks",
  "rollout_rollback_checks",
];

export function buildValidationPack(input: {
  requiredTests: string[];
  personaConsistencyChecks: string[];
  protectedIntentChecks: string[];
  fallbackChecks: string[];
  surfaceChecks: string[];
}): LanguageValidationPack {
  return {
    requiredTests: input.requiredTests,
    personaConsistencyChecks: input.personaConsistencyChecks,
    protectedIntentChecks: input.protectedIntentChecks,
    fallbackChecks: input.fallbackChecks,
    surfaceChecks: input.surfaceChecks,
  };
}

export function validateLanguagePack(pack: LanguagePack): string[] {
  const allErrors: string[] = [];

  // Validate manifest
  allErrors.push(...validateManifest(pack.manifest).map((e) => `manifest: ${e}`));

  // Validate understanding
  allErrors.push(...validateUnderstandingProfile(pack.understanding).map((e) => `understanding: ${e}`));

  // Validate UX
  allErrors.push(...validateUxPack(pack.ux).map((e) => `ux: ${e}`));

  // Validate persona
  allErrors.push(...validatePersonaPack(pack.persona).map((e) => `persona: ${e}`));

  // Validate voice if present
  if (pack.voice) {
    allErrors.push(...validateVoicePack(pack.voice).map((e) => `voice: ${e}`));
  }

  // Check required tests
  const missingTests = REQUIRED_TESTS.filter(
    (requiredTest) => !pack.validation.requiredTests.includes(requiredTest),
  );
  if (missingTests.length > 0) {
    allErrors.push(`Missing required tests: ${missingTests.join(", ")}`);
  }

  return allErrors;
}

export function assertPackReady(pack: LanguagePack): void {
  const errors = validateLanguagePack(pack);
  if (errors.length > 0) {
    throw new LanguagePackValidationFailedError(errors, pack.languageCode);
  }
}

export function checkPersonaConsistencyAll(packs: LanguagePack[]): string[] {
  const violations: string[] = [];

  if (packs.length < 2) return violations;

  const referencePack = packs[0];

  for (let i = 1; i < packs.length; i++) {
    const pack = packs[i];
    const packViolations: string[] = [];

    // Persona ID must match
    if (pack.persona.personaId !== referencePack.persona.personaId) {
      packViolations.push(
        `personaId mismatch: ${pack.persona.personaId} vs ${referencePack.persona.personaId}. One persona across all languages.`,
      );
    }

    // Tone class modes must match
    const refModes = Object.keys(referencePack.persona.toneClassByMode);
    const packModes = Object.keys(pack.persona.toneClassByMode);

    if (refModes.length !== packModes.length) {
      packViolations.push(
        `Tone class mode count mismatch: ${packModes.length} vs ${refModes.length}`,
      );
    }

    for (const mode of refModes) {
      if (!pack.persona.toneClassByMode[mode as keyof typeof pack.persona.toneClassByMode]) {
        packViolations.push(`Missing tone class for mode: ${mode}`);
      }
    }

    if (packViolations.length > 0) {
      violations.push(...packViolations.map((v) => `[${pack.languageCode}] ${v}`));
    }
  }

  return violations;
}
