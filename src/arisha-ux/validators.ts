// ─────────────────────────────────────────────────────────────
// ARISHA LANGUAGE UX FILES v1.0 — Validators
//
// Checks:
// - all required phrase classes exist
// - no empty required arrays
// - runtime truth pack complete
// - fallback pack complete
// - surface behavior complete
// - personaId = "arisha"
// - languageCode valid
// - status valid
// - minimum content rules met
// ─────────────────────────────────────────────────────────────

import type {
  ArishaLanguageUxFile,
  ArishaUxValidationError,
  PhraseSet,
  ArishaUxModePack,
  ArishaRuntimeTruthPack,
  ArishaFallbackPack,
  ArishaSurfaceBehaviorPack,
} from "./types.js";

const VALID_LANGUAGES = new Set(["ru", "en", "uz"] as const);
const VALID_STATUSES = new Set(["draft", "validated", "production"] as const);

const REQUIRED_MODE_SECTIONS: (keyof ArishaUxModePack)[] = [
  "greetings",
  "confirmations",
  "clarifications",
  "explanations",
  "help",
  "blocked",
  "safeFailure",
];

const REQUIRED_RUNTIME_TRUTH_SECTIONS: (keyof ArishaRuntimeTruthPack)[] = [
  "prepared",
  "handedOff",
  "transferred",
  "delivered",
  "executed",
  "blocked",
  "reviewRequired",
];

const REQUIRED_FALLBACK_SECTIONS: (keyof ArishaFallbackPack)[] = [
  "languageUncertain",
  "intentUncertain",
  "surfaceLimited",
  "voiceUnavailable",
  "safeDowngrade",
];

const REQUIRED_SURFACES: (keyof ArishaSurfaceBehaviorPack)[] = [
  "web",
  "tgm",
  "telegram",
  "voice",
];

// -- Minimum content rules --
const MIN_GREETINGS_SHORT = 4;
const MIN_CONFIRMATIONS_SHORT = 6;
const MIN_CLARIFICATIONS_SHORT = 5;
const MIN_SAFE_FAILURE_SHORT = 4;
const MIN_RUNTIME_TRUTH_SHORT = 3;

function checkPhraseSetNotEmpty(phrase: PhraseSet | undefined, path: string, errors: ArishaUxValidationError[]) {
  if (!phrase) {
    errors.push({ path, message: "Phrase set is missing" });
    return;
  }
  if (phrase.short.length === 0) {
    errors.push({ path: `${path}.short`, message: "short array must not be empty" });
  }
  if (phrase.medium.length === 0) {
    errors.push({ path: `${path}.medium`, message: "medium array must not be empty" });
  }
}

function checkMinimumContent(
  modePack: ArishaUxModePack,
  modeName: string,
  errors: ArishaUxValidationError[],
) {
  if (modePack.greetings.short.length < MIN_GREETINGS_SHORT) {
    errors.push({
      path: `modeVariants.${modeName}.greetings.short`,
      message: `Need at least ${MIN_GREETINGS_SHORT} phrases, got ${modePack.greetings.short.length}`,
    });
  }
  if (modePack.confirmations.short.length < MIN_CONFIRMATIONS_SHORT) {
    errors.push({
      path: `modeVariants.${modeName}.confirmations.short`,
      message: `Need at least ${MIN_CONFIRMATIONS_SHORT} phrases, got ${modePack.confirmations.short.length}`,
    });
  }
  if (modePack.clarifications.short.length < MIN_CLARIFICATIONS_SHORT) {
    errors.push({
      path: `modeVariants.${modeName}.clarifications.short`,
      message: `Need at least ${MIN_CLARIFICATIONS_SHORT} phrases, got ${modePack.clarifications.short.length}`,
    });
  }
  if (modePack.safeFailure.short.length < MIN_SAFE_FAILURE_SHORT) {
    errors.push({
      path: `modeVariants.${modeName}.safeFailure.short`,
      message: `Need at least ${MIN_SAFE_FAILURE_SHORT} phrases, got ${modePack.safeFailure.short.length}`,
    });
  }
}

function checkRuntimeTruthMinimum(
  truth: ArishaRuntimeTruthPack,
  errors: ArishaUxValidationError[],
) {
  for (const section of REQUIRED_RUNTIME_TRUTH_SECTIONS) {
    if (truth[section].short.length < MIN_RUNTIME_TRUTH_SHORT) {
      errors.push({
        path: `runtimeTruth.${section}.short`,
        message: `Need at least ${MIN_RUNTIME_TRUTH_SHORT} phrases, got ${truth[section].short.length}`,
      });
    }
  }
}

export function validateArishaUxFile(file: ArishaLanguageUxFile): ArishaUxValidationError[] {
  const errors: ArishaUxValidationError[] = [];

  // personaId
  if (file.personaId !== "arisha") {
    errors.push({ path: "personaId", message: `Must be "arisha", got "${file.personaId}"` });
  }

  // languageCode
  if (!VALID_LANGUAGES.has(file.languageCode)) {
    errors.push({ path: "languageCode", message: `Invalid language: ${file.languageCode}` });
  }

  // status
  if (!VALID_STATUSES.has(file.status)) {
    errors.push({ path: "status", message: `Invalid status: ${file.status}` });
  }

  // version
  if (!file.version || file.version.trim() === "") {
    errors.push({ path: "version", message: "Version is required" });
  }

  // Mode variants
  for (const mode of (["creator", "user", "neutral"] as const)) {
    const modePack = file.modeVariants[mode];
    if (!modePack) {
      errors.push({ path: `modeVariants.${mode}`, message: "Mode pack is missing" });
      continue;
    }

    for (const section of REQUIRED_MODE_SECTIONS) {
      checkPhraseSetNotEmpty(modePack[section], `modeVariants.${mode}.${section}`, errors);
    }

    checkMinimumContent(modePack, mode, errors);
  }

  // Runtime truth
  for (const section of REQUIRED_RUNTIME_TRUTH_SECTIONS) {
    checkPhraseSetNotEmpty(file.runtimeTruth[section], `runtimeTruth.${section}`, errors);
  }
  checkRuntimeTruthMinimum(file.runtimeTruth, errors);

  // Fallback
  for (const section of REQUIRED_FALLBACK_SECTIONS) {
    checkPhraseSetNotEmpty(file.fallback[section], `fallback.${section}`, errors);
  }

  // Surface behavior
  for (const surface of REQUIRED_SURFACES) {
    const profile = file.surfaceBehavior[surface];
    if (!profile) {
      errors.push({ path: `surfaceBehavior.${surface}`, message: "Surface profile is missing" });
      continue;
    }
    if (!profile.defaultLength) {
      errors.push({ path: `surfaceBehavior.${surface}.defaultLength`, message: "defaultLength is required" });
    }
    if (!profile.maxSentences || profile.maxSentences < 1) {
      errors.push({ path: `surfaceBehavior.${surface}.maxSentences`, message: "maxSentences must be >= 1" });
    }
    if (typeof profile.prefersDirectness !== "boolean") {
      errors.push({ path: `surfaceBehavior.${surface}.prefersDirectness`, message: "prefersDirectness must be boolean" });
    }
    if (typeof profile.prefersClarifyFirst !== "boolean") {
      errors.push({ path: `surfaceBehavior.${surface}.prefersClarifyFirst`, message: "prefersClarifyFirst must be boolean" });
    }
  }

  return errors;
}

// -- Tone sanity checks --
const FORBIDDEN_PATTERNS = [
  /yay!/i,
  /woohoo/i,
  /🎉/,
  /awesome!/i,
  /fantastic!/i,
];

export function checkForbiddenPatterns(file: ArishaLanguageUxFile): ArishaUxValidationError[] {
  const errors: ArishaUxValidationError[] = [];
  const text = JSON.stringify(file);

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      errors.push({
        path: "tone",
        message: `Forbidden pattern found: ${pattern.source}`,
      });
    }
  }

  return errors;
}
