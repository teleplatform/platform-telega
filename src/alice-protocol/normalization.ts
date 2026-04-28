// ─────────────────────────────────────────────────────────────
// ALICE REQUEST/RESPONSE PROTOCOL ADAPTER v1.0 — Normalization Helpers
//
// AliceProtocolRequest → AliceProtocolNormalizedRequest
// Extracts text, session meta, detects language, detects entry intent,
// validates minimum protocol validity.
// No raw protocol payload goes further directly.
// ─────────────────────────────────────────────────────────────

import crypto from "node:crypto";
import type {
  AliceProtocolRequest,
  AliceProtocolNormalizedRequest,
  EntryPattern,
} from "./types.js";
import { extractAliceText, extractAliceSessionMeta, hasExtractableText } from "./request.js";
import { detectArishaEntryIntent } from "./session.js";
import { getSafeProtocolVersion } from "./selectors.js";

export function normalizeAliceProtocolRequest(
  request: AliceProtocolRequest,
  entryPatterns?: EntryPattern[],
): AliceProtocolNormalizedRequest {
  const text = extractAliceText(request);
  const session = extractAliceSessionMeta(request);
  const locale = request.meta?.locale ?? "ru-RU";

  // Detect language from locale
  const languageCode = detectProtocolLanguage(locale);

  // Detect entry intent
  const patterns = entryPatterns ?? [];
  const entryIntent = detectArishaEntryIntent(text.toLowerCase(), patterns, languageCode);

  // Validate
  const validationErrors: string[] = [];
  if (!request.session?.session_id) {
    validationErrors.push("session.session_id is required");
  }
  if (!text || text.length === 0) {
    validationErrors.push("No extractable text (command or original_utterance required)");
  }

  return {
    protocolRequestId: crypto.randomUUID(),
    session,
    text,
    languageCode,
    valid: validationErrors.length === 0,
    validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
    entryIntent,
  };
}

export function detectProtocolLanguage(locale: string): "ru" | "en" | "uz" {
  if (locale.startsWith("ru")) return "ru";
  if (locale.startsWith("en")) return "en";
  if (locale.startsWith("uz")) return "uz";
  // Default to ru for Alice
  return "ru";
}

export function isValidAliceProtocolRequest(request: AliceProtocolRequest): boolean {
  return hasExtractableText(request) && !!request.session?.session_id;
}
