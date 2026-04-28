// ─────────────────────────────────────────────────────────────
// FORGE BRIDGE HARDENING v1.0 — Language Resolver
// Implements ARISHA Multilingual Language Strategy v1.0
//
// Language Resolution Policy (strict priority):
//   1. explicit user-selected language
//   2. current conversation language
//   3. user profile language
//   4. device/region/surface hint
//   5. fallback = "en"
// ─────────────────────────────────────────────────────────────

import type { ForgeBundleLanguageContext, SupportedLanguageCode } from "./types.js";

const SUPPORTED_LANGUAGES: Set<SupportedLanguageCode> = new Set([
  "ru",
  "en",
  "uz",
  "de",
  "fr",
  "es",
  "ja",
]);

function isValidLanguage(code: string | undefined): code is SupportedLanguageCode {
  return code !== undefined && SUPPORTED_LANGUAGES.has(code as SupportedLanguageCode);
}

export function resolveLanguage(input: {
  requestedLanguage?: SupportedLanguageCode;
  conversationLanguage?: SupportedLanguageCode;
  profileLanguage?: SupportedLanguageCode;
  surfaceHint?: SupportedLanguageCode;
}): ForgeBundleLanguageContext {
  // Priority 1: explicit user-selected language
  if (isValidLanguage(input.requestedLanguage)) {
    return {
      resolvedLanguage: input.requestedLanguage,
      requestedLanguage: input.requestedLanguage,
      profileLanguage: input.profileLanguage,
      conversationLanguage: input.conversationLanguage,
      fallbackLanguage: "en",
      multilingualReady: true,
    };
  }

  // Priority 2: current conversation language
  if (isValidLanguage(input.conversationLanguage)) {
    return {
      resolvedLanguage: input.conversationLanguage,
      requestedLanguage: input.requestedLanguage,
      profileLanguage: input.profileLanguage,
      conversationLanguage: input.conversationLanguage,
      fallbackLanguage: "en",
      multilingualReady: true,
    };
  }

  // Priority 3: user profile language
  if (isValidLanguage(input.profileLanguage)) {
    return {
      resolvedLanguage: input.profileLanguage,
      requestedLanguage: input.requestedLanguage,
      profileLanguage: input.profileLanguage,
      conversationLanguage: input.conversationLanguage,
      fallbackLanguage: "en",
      multilingualReady: true,
    };
  }

  // Priority 4: device/region/surface hint
  if (isValidLanguage(input.surfaceHint)) {
    return {
      resolvedLanguage: input.surfaceHint,
      requestedLanguage: input.requestedLanguage,
      profileLanguage: input.profileLanguage,
      conversationLanguage: input.conversationLanguage,
      fallbackLanguage: "en",
      multilingualReady: true,
    };
  }

  // Priority 5: fallback = "en"
  return {
    resolvedLanguage: "en",
    requestedLanguage: input.requestedLanguage,
    profileLanguage: input.profileLanguage,
    conversationLanguage: input.conversationLanguage,
    fallbackLanguage: "en",
    multilingualReady: false,
  };
}
