// ─────────────────────────────────────────────────────────────
// MULTILINGUAL LANGUAGE PACK CONTRACT v1.0 — Manifest Builder
// ─────────────────────────────────────────────────────────────

import type { LanguagePackManifest } from "./types.js";
import { LanguagePackInvalidError } from "./errors.js";

const VALID_TIERS = new Set(["tier1", "tier2", "tier3"] as const);
const VALID_SURFACES = new Set(["web", "tgm", "telegram", "voice", "operator"] as const);

export function buildManifest(input: {
  languageCode: string;
  languageName: string;
  nativeName?: string;
  tier: LanguagePackManifest["tier"];
  rtl?: boolean;
  supportedSurfaces: LanguagePackManifest["supportedSurfaces"];
  notes?: string[];
}): LanguagePackManifest {
  if (!input.languageCode || input.languageCode.trim() === "") {
    throw new LanguagePackInvalidError("languageCode is required");
  }
  if (!input.languageName || input.languageName.trim() === "") {
    throw new LanguagePackInvalidError("languageName is required", input.languageCode);
  }
  if (!VALID_TIERS.has(input.tier)) {
    throw new LanguagePackInvalidError(
      `Invalid tier: ${input.tier}. Must be one of: ${Array.from(VALID_TIERS).join(", ")}`,
      input.languageCode,
    );
  }
  if (!input.supportedSurfaces || input.supportedSurfaces.length === 0) {
    throw new LanguagePackInvalidError(
      "supportedSurfaces is required and must not be empty",
      input.languageCode,
    );
  }
  for (const surface of input.supportedSurfaces) {
    if (!VALID_SURFACES.has(surface)) {
      throw new LanguagePackInvalidError(
        `Invalid surface: ${surface}. Must be one of: ${Array.from(VALID_SURFACES).join(", ")}`,
        input.languageCode,
      );
    }
  }

  return {
    languageCode: input.languageCode,
    languageName: input.languageName,
    nativeName: input.nativeName,
    tier: input.tier,
    rtl: input.rtl ?? false,
    fallbackLanguage: "en",
    multilingualReady: true,
    supportedSurfaces: input.supportedSurfaces,
    notes: input.notes,
  };
}

export function validateManifest(manifest: LanguagePackManifest): string[] {
  const errors: string[] = [];

  if (!manifest.languageCode) errors.push("languageCode is required");
  if (!manifest.languageName) errors.push("languageName is required");
  if (!VALID_TIERS.has(manifest.tier)) errors.push(`Invalid tier: ${manifest.tier}`);
  if (!manifest.supportedSurfaces || manifest.supportedSurfaces.length === 0) {
    errors.push("supportedSurfaces is required and must not be empty");
  }
  if (manifest.fallbackLanguage !== "en") {
    errors.push("fallbackLanguage must be 'en'");
  }

  return errors;
}
