// ─────────────────────────────────────────────────────────────
// ALICE VOICE BRIDGE ADAPTER v1.0 — Builtin Adapter + Entry Patterns
//
// Production-grade Alice voice bridge adapter with RU entry patterns.
// EN/UZ patterns included as placeholders without false completeness promise.
// ─────────────────────────────────────────────────────────────

import type { AliceVoiceBridgeAdapter, EntryPattern } from "./types.js";
import { setAliceBridgeAdapter, setSupportedEntryPatterns } from "./selectors.js";

// -- Builtin Alice Bridge Adapter --
export const aliceVoiceBridgeAdapter: AliceVoiceBridgeAdapter = {
  adapterId: "alice_voice_bridge_v1",
  version: "1.0.0",
  supportsArishaEntryDetection: true,
  supportsSessionBinding: true,
  supportsTransportTruth: true,
  supportsFallbackToTextSurface: true,
};

// -- Builtin Entry Patterns --
export const BUILTIN_ENTRY_PATTERNS: EntryPattern[] = [
  // RU patterns (primary)
  { pattern: "алиса позови аришу", languageCode: "ru", intent: "arisha_entry" },
  { pattern: "алиса включи аришу", languageCode: "ru", intent: "arisha_entry" },
  { pattern: "алиса переключи на аришу", languageCode: "ru", intent: "arisha_entry" },

  // EN placeholders (not full coverage promised)
  { pattern: "alice call arisha", languageCode: "en", intent: "arisha_entry" },
  { pattern: "alice switch to arisha", languageCode: "en", intent: "arisha_entry" },

  // UZ placeholders (not full coverage promised)
  { pattern: "alisa arishani chaqir", languageCode: "uz", intent: "arisha_entry" },
  { pattern: "alisa arishaga o'tkaz", languageCode: "uz", intent: "arisha_entry" },
];

// Auto-register
setAliceBridgeAdapter(aliceVoiceBridgeAdapter);
setSupportedEntryPatterns(BUILTIN_ENTRY_PATTERNS);
