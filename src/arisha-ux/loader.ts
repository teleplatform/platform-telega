// ─────────────────────────────────────────────────────────────
// ARISHA LANGUAGE UX FILES v1.0 — Loader / Registry
//
// Loads and registers Arisha UX files.
// Sets up selectors with the registry for phrase picking.
// ─────────────────────────────────────────────────────────────

import type { ArishaLanguageUxFile, ArishaSupportedLanguage, ArishaUxValidationError } from "./types.js";
import { validateArishaUxFile, checkForbiddenPatterns } from "./validators.js";
import { setRegistry } from "./selectors.js";

const _registry: Map<string, ArishaLanguageUxFile> = new Map();

export function registerUxFile(file: ArishaLanguageUxFile): void {
  _registry.set(file.languageCode, file);
  // Update selectors with the registry
  setRegistry(_registry, _registry.get("en"));
}

export function getUxFile(languageCode: string): ArishaLanguageUxFile | undefined {
  return _registry.get(languageCode);
}

export function hasUxFile(languageCode: string): boolean {
  return _registry.has(languageCode);
}

export function listUxFiles(): ArishaLanguageUxFile[] {
  return Array.from(_registry.values());
}

export function getActiveLanguages(): ArishaSupportedLanguage[] {
  return Array.from(_registry.keys()) as ArishaSupportedLanguage[];
}

export function validateAll(): Map<string, ArishaUxValidationError[]> {
  const results = new Map<string, ArishaUxValidationError[]>();

  for (const [lang, file] of _registry) {
    const errors = [...validateArishaUxFile(file), ...checkForbiddenPatterns(file)];
    results.set(lang, errors);
  }

  return results;
}

export function isProductionReady(languageCode: string): boolean {
  const file = _registry.get(languageCode);
  if (!file) return false;
  return file.status === "production" && validateArishaUxFile(file).length === 0;
}
