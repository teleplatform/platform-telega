// ─────────────────────────────────────────────────────────────
// ALICE VOICE BRIDGE ADAPTER v1.0 — Normalization Helpers
//
// Any Alice ingress must pass through normalization:
// - text cleanup
// - language detection
// - entry intent detection
// - minimal validity check
// - persona = arisha binding
// No raw Alice payload goes further directly.
// ─────────────────────────────────────────────────────────────

import type { AliceVoiceRequest, AliceVoiceNormalizedInput, EntryPattern } from "./types.js";
import { getSupportedEntryPatterns } from "./selectors.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function normalizeAliceRequest(
  request: AliceVoiceRequest,
  entryPatterns?: EntryPattern[],
): AliceVoiceNormalizedInput {
  const text = (request.inputText ?? "").trim();
  const lowerText = text.toLowerCase();
  const locale = request.locale ?? "ru-RU";

  // Detect language
  const languageCode = detectAliceLanguage(request, locale);

  // Detect entry intent
  const patterns = entryPatterns ?? getSupportedEntryPatterns(languageCode);
  const entryIntent = detectArishaEntryIntent(lowerText, patterns);

  // Validate
  const validationErrors: string[] = [];
  if (!text || text.length === 0) {
    validationErrors.push("Empty input text");
  }

  return {
    requestId: request.requestId,
    sourceSurface: "alice",
    sessionId: request.aliceSessionId,
    userId: request.userId,
    text,
    languageCode,
    entryIntent,
    personaId: "arisha",
    valid: validationErrors.length === 0,
    validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
  };
}

export function detectAliceLanguage(
  request: AliceVoiceRequest,
  localeHint: string = "ru-RU",
): "ru" | "en" | "uz" {
  // Explicit locale mapping
  if (localeHint.startsWith("ru")) return "ru";
  if (localeHint.startsWith("en")) return "en";
  if (localeHint.startsWith("uz")) return "uz";

  // Fallback to ru for Alice (default Yandex locale)
  return "ru";
}

export function detectArishaEntryIntent(
  lowerText: string,
  patterns: EntryPattern[],
): "arisha_entry" | "plain_voice_turn" | "unknown" {
  if (!lowerText || lowerText.length === 0) return "unknown";

  for (const pattern of patterns) {
    if (lowerText.includes(pattern.pattern)) {
      return "arisha_entry";
    }
  }

  // Has text but no entry pattern — assume plain voice turn
  return "plain_voice_turn";
}

export function isValidNormalizedInput(input: AliceVoiceNormalizedInput): boolean {
  return input.valid && input.text.length > 0;
}
