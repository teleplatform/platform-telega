// ─────────────────────────────────────────────────────────────
// ALICE REQUEST/RESPONSE PROTOCOL ADAPTER v1.0 — Session / Entry Detection
//
// Entry intent detection for protocol-normalized text.
// Uses entry patterns from Alice bridge layer.
// ─────────────────────────────────────────────────────────────

import type { EntryPattern } from "./types.js";

export function detectArishaEntryIntent(
  lowerText: string,
  patterns: EntryPattern[],
  languageCode: "ru" | "en" | "uz" = "ru",
): "arisha_entry" | "plain_voice_turn" | "unknown" {
  if (!lowerText || lowerText.length === 0) return "unknown";

  // Filter patterns by language
  const langPatterns = patterns.filter((p) => p.languageCode === languageCode);

  for (const pattern of langPatterns) {
    if (lowerText.includes(pattern.pattern)) {
      return "arisha_entry";
    }
  }

  return "plain_voice_turn";
}
