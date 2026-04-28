// ─────────────────────────────────────────────────────────────
// ARISHA LANGUAGE UX FILES v1.0 — Fallback Resolution
//
// If language not found → fallback to "en"
// If mode not found → fallback to "neutral"
// If phrase class empty → fallback to "en" phrase class
// If "en" also empty → throw validated error
// ─────────────────────────────────────────────────────────────

import type {
  ArishaLanguageUxFile,
  PhraseSet,
  ArishaSupportedLanguage,
} from "./types.js";

export function resolveLanguage(
  requested: string,
  registry: Map<string, ArishaLanguageUxFile>,
  defaultLanguage: ArishaSupportedLanguage = "en",
): ArishaSupportedLanguage | undefined {
  if (registry.has(requested as ArishaSupportedLanguage)) {
    return requested as ArishaSupportedLanguage;
  }
  if (registry.has(defaultLanguage)) {
    return defaultLanguage;
  }
  return undefined;
}

export function resolvePhraseSet(
  primary: PhraseSet | undefined,
  fallback: PhraseSet | undefined,
): PhraseSet | undefined {
  // Use primary if it has content
  if (primary && primary.short.length > 0) {
    return primary;
  }
  // Fall back to fallback language's phrase set
  if (fallback && fallback.short.length > 0) {
    return fallback;
  }
  // Both empty → undefined (caller should throw error)
  return undefined;
}

export function pickRandomPhrase(phraseSet: PhraseSet | undefined, length?: "short" | "medium" | "long"): string | undefined {
  if (!phraseSet) return undefined;

  // Try requested length first, then fall back
  const targetLength = length ?? "short";
  const phrases = phraseSet[targetLength] ?? phraseSet.short;

  if (phrases.length === 0) {
    // Try other lengths
    if (phraseSet.short.length > 0) return randomFrom(phraseSet.short);
    if (phraseSet.medium.length > 0) return randomFrom(phraseSet.medium);
    if (phraseSet.long && phraseSet.long.length > 0) return randomFrom(phraseSet.long);
    return undefined;
  }

  return randomFrom(phrases);
}

function randomFrom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}
