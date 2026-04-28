// ─────────────────────────────────────────────────────────────
// ARISHA LANGUAGE UX FILES v1.0 — Selectors
//
// Selector functions for picking phrases from UX files:
// - getArishaUxFile(languageCode)
// - getModePack(languageCode, mode)
// - pickGreeting(languageCode, mode, length?)
// - pickConfirmation(languageCode, mode, length?)
// - pickClarification(languageCode, mode, length?)
// - pickRuntimeTruth(languageCode, status, length?)
// - pickFallback(languageCode, kind, length?)
// ─────────────────────────────────────────────────────────────

import type {
  ArishaLanguageUxFile,
  ArishaUxModePack,
  ArishaRuntimeTruthPack,
  ArishaFallbackPack,
  PhraseSet,
  ArishaSupportedLanguage,
} from "./types.js";
import { resolveModePack } from "./persona.js";
import { getPreferredLength } from "./surface.js";
import { pickRandomPhrase } from "./fallback.js";

// -- Registry access (set by loader) --
let _registry: Map<string, ArishaLanguageUxFile> = new Map();
let _fallbackFile: ArishaLanguageUxFile | undefined;

export function setRegistry(registry: Map<string, ArishaLanguageUxFile>, fallbackFile?: ArishaLanguageUxFile) {
  _registry = registry;
  _fallbackFile = fallbackFile;
}

export function getArishaUxFile(languageCode: string): ArishaLanguageUxFile | undefined {
  return _registry.get(languageCode);
}

export function getModePack(
  languageCode: string,
  mode: "creator" | "user" | "neutral" = "neutral",
): ArishaUxModePack | undefined {
  const file = getArishaUxFile(languageCode) ?? _fallbackFile;
  if (!file) return undefined;
  return resolveModePack(file, mode);
}

export function pickGreeting(
  languageCode: string,
  mode: "creator" | "user" | "neutral" = "neutral",
  length?: "short" | "medium" | "long",
  surface?: keyof ArishaLanguageUxFile["surfaceBehavior"],
): string | undefined {
  const file = getArishaUxFile(languageCode) ?? _fallbackFile;
  if (!file) return undefined;

  const modePack = resolveModePack(file, mode);
  const preferredLength = length ?? (surface ? getPreferredLength(file, surface) : "short");

  return pickRandomPhrase(modePack.greetings, preferredLength);
}

export function pickConfirmation(
  languageCode: string,
  mode: "creator" | "user" | "neutral" = "neutral",
  length?: "short" | "medium" | "long",
  surface?: keyof ArishaLanguageUxFile["surfaceBehavior"],
): string | undefined {
  const file = getArishaUxFile(languageCode) ?? _fallbackFile;
  if (!file) return undefined;

  const modePack = resolveModePack(file, mode);
  const preferredLength = length ?? (surface ? getPreferredLength(file, surface) : "short");

  return pickRandomPhrase(modePack.confirmations, preferredLength);
}

export function pickClarification(
  languageCode: string,
  mode: "creator" | "user" | "neutral" = "neutral",
  length?: "short" | "medium" | "long",
  surface?: keyof ArishaLanguageUxFile["surfaceBehavior"],
): string | undefined {
  const file = getArishaUxFile(languageCode) ?? _fallbackFile;
  if (!file) return undefined;

  const modePack = resolveModePack(file, mode);
  const preferredLength = length ?? (surface ? getPreferredLength(file, surface) : "short");

  return pickRandomPhrase(modePack.clarifications, preferredLength);
}

export function pickExplanation(
  languageCode: string,
  mode: "creator" | "user" | "neutral" = "neutral",
  length?: "short" | "medium" | "long",
  surface?: keyof ArishaLanguageUxFile["surfaceBehavior"],
): string | undefined {
  const file = getArishaUxFile(languageCode) ?? _fallbackFile;
  if (!file) return undefined;

  const modePack = resolveModePack(file, mode);
  const preferredLength = length ?? (surface ? getPreferredLength(file, surface) : "short");

  return pickRandomPhrase(modePack.explanations, preferredLength);
}

export function pickHelp(
  languageCode: string,
  mode: "creator" | "user" | "neutral" = "neutral",
  length?: "short" | "medium" | "long",
  surface?: keyof ArishaLanguageUxFile["surfaceBehavior"],
): string | undefined {
  const file = getArishaUxFile(languageCode) ?? _fallbackFile;
  if (!file) return undefined;

  const modePack = resolveModePack(file, mode);
  const preferredLength = length ?? (surface ? getPreferredLength(file, surface) : "short");

  return pickRandomPhrase(modePack.help, preferredLength);
}

export function pickBlocked(
  languageCode: string,
  mode: "creator" | "user" | "neutral" = "neutral",
  length?: "short" | "medium" | "long",
  surface?: keyof ArishaLanguageUxFile["surfaceBehavior"],
): string | undefined {
  const file = getArishaUxFile(languageCode) ?? _fallbackFile;
  if (!file) return undefined;

  const modePack = resolveModePack(file, mode);
  const preferredLength = length ?? (surface ? getPreferredLength(file, surface) : "short");

  return pickRandomPhrase(modePack.blocked, preferredLength);
}

export function pickSafeFailure(
  languageCode: string,
  mode: "creator" | "user" | "neutral" = "neutral",
  length?: "short" | "medium" | "long",
  surface?: keyof ArishaLanguageUxFile["surfaceBehavior"],
): string | undefined {
  const file = getArishaUxFile(languageCode) ?? _fallbackFile;
  if (!file) return undefined;

  const modePack = resolveModePack(file, mode);
  const preferredLength = length ?? (surface ? getPreferredLength(file, surface) : "short");

  return pickRandomPhrase(modePack.safeFailure, preferredLength);
}

export function pickRuntimeTruth(
  languageCode: string,
  status: keyof ArishaRuntimeTruthPack,
  length?: "short" | "medium" | "long",
  surface?: keyof ArishaLanguageUxFile["surfaceBehavior"],
): string | undefined {
  const file = getArishaUxFile(languageCode) ?? _fallbackFile;
  if (!file) return undefined;

  const truthSection = file.runtimeTruth[status];
  if (!truthSection) return undefined;

  const preferredLength = length ?? (surface ? getPreferredLength(file, surface) : "short");

  return pickRandomPhrase(truthSection, preferredLength);
}

export function pickFallback(
  languageCode: string,
  kind: keyof ArishaFallbackPack,
  length?: "short" | "medium" | "long",
  surface?: keyof ArishaLanguageUxFile["surfaceBehavior"],
): string | undefined {
  const file = getArishaUxFile(languageCode) ?? _fallbackFile;
  if (!file) return undefined;

  const fallbackSection = file.fallback[kind];
  if (!fallbackSection) return undefined;

  const preferredLength = length ?? (surface ? getPreferredLength(file, surface) : "short");

  return pickRandomPhrase(fallbackSection, preferredLength);
}
