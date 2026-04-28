// ─────────────────────────────────────────────────────────────
// MULTILINGUAL LANGUAGE PACK CONTRACT v1.0 — Language Pack Loader/Registry
//
// Central registry for all language packs.
// Handles loading, validation, feature flag checks, and queries.
// ─────────────────────────────────────────────────────────────

import type { LanguagePack, LanguageRegistry, FeatureFlagCheckInput, LanguageCapabilityMatrix } from "./types.js";
import { LanguagePackNotFoundError, LanguageNotReadyError } from "./errors.js";
import { validateLanguagePack } from "./validation.js";
import { isLanguageEnabledFor } from "./rollout.js";
import { buildCapabilityMatrix } from "./capability.js";

// -- Built-in language packs registry --
const _packs: Map<string, LanguagePack> = new Map();

let _activeLanguage = "en";
const _defaultLanguage = "en";

export function registerPack(pack: LanguagePack): void {
  _packs.set(pack.languageCode, pack);
}

export function getPack(languageCode: string): LanguagePack {
  const pack = _packs.get(languageCode);
  if (!pack) {
    throw new LanguagePackNotFoundError(languageCode);
  }
  return pack;
}

export function hasPack(languageCode: string): boolean {
  return _packs.has(languageCode);
}

export function listPacks(): LanguagePack[] {
  return Array.from(_packs.values());
}

export function setActiveLanguage(languageCode: string): void {
  if (!hasPack(languageCode)) {
    throw new LanguagePackNotFoundError(languageCode);
  }
  _activeLanguage = languageCode;
}

export function getActiveLanguage(): string {
  return _activeLanguage;
}

export function getDefaultLanguage(): string {
  return _defaultLanguage;
}

export function validatePack(languageCode: string): string[] {
  const pack = getPack(languageCode);
  return validateLanguagePack(pack);
}

export function isPackReady(languageCode: string): boolean {
  const pack = _packs.get(languageCode);
  if (!pack) return false;

  // Only "production" status means fully ready
  return pack.status === "production";
}

export function assertPackReady(languageCode: string): void {
  const pack = getPack(languageCode);
  if (pack.status !== "production") {
    throw new LanguageNotReadyError(languageCode, pack.status);
  }
}

export function checkLanguageEnabled(input: FeatureFlagCheckInput): boolean {
  const pack = _packs.get(input.languageCode);
  if (!pack) return false;

  return isLanguageEnabledFor(pack.rollout, input);
}

export function getCapabilityMatrix(languageCode: string): LanguageCapabilityMatrix {
  const pack = getPack(languageCode);

  return buildCapabilityMatrix({
    web: pack.manifest.supportedSurfaces.includes("web") ? "full" : "none",
    tgm: pack.manifest.supportedSurfaces.includes("tgm") ? "full" : "none",
    telegram: pack.manifest.supportedSurfaces.includes("telegram") ? "full" : "none",
    voice: pack.voice?.voiceReady ? "full" : pack.voice?.textReady ? "text_ready" : "none",
    operator: pack.manifest.supportedSurfaces.includes("operator") ? "full" : "none",
    safeActions: true,
    protectedActions: pack.status === "production",
  });
}

export function getRegistry(): LanguageRegistry {
  return {
    packs: _packs,
    activeLanguage: _activeLanguage,
    defaultLanguage: _defaultLanguage,
  };
}

// -- Lifecycle promotion helper --
const STATUS_ORDER: LanguagePack["status"][] = [
  "declared",
  "understanding_ready",
  "localized",
  "validated",
  "limited_rollout",
  "production",
];

export function promotePack(languageCode: string, newStatus: LanguagePack["status"]): LanguagePack {
  const pack = getPack(languageCode);

  const currentIndex = STATUS_ORDER.indexOf(pack.status);
  const newIndex = STATUS_ORDER.indexOf(newStatus);

  if (newIndex <= currentIndex) {
    // Demotion or same status — still allowed (for rollback)
  }

  pack.status = newStatus;
  _packs.set(languageCode, pack);

  return pack;
}
