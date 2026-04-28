// ─────────────────────────────────────────────────────────────
// ALICE PUBLISH / SKILL REGISTRATION PACK v1.0 — Invocation Profile
//
// Explicitly describes how Alice enters Arisha:
// - canonical entry phrases
// - invocation mode
// - follow-up and continuation support
// ─────────────────────────────────────────────────────────────

import type { AliceSkillInvocationProfile } from "./types.js";

// Canonical entry phrases for RU (primary)
const RU_ENTRY_PHRASES = [
  "Алиса, позови Аришу",
  "Алиса, включи Аришу",
  "Алиса, переключи на Аришу",
];

// EN placeholders (staged-ready, not fully launched)
const EN_ENTRY_PHRASES = [
  "Alice, call Arisha",
  "Alice, switch to Arisha",
];

// UZ placeholders (staged-ready, not fully launched)
const UZ_ENTRY_PHRASES = [
  "Alisa, Arishani chaqir",
  "Alisa, Arishaga o'tkaz",
];

export function buildAliceInvocationProfile(input?: {
  entryPhrases?: string[];
  requiresExplicitInvocation?: boolean;
  supportsFollowupTurns?: boolean;
  supportsSessionContinuation?: boolean;
}): AliceSkillInvocationProfile {
  return {
    entryPhrases: input?.entryPhrases ?? RU_ENTRY_PHRASES,
    invocationMode: "voice_entry",
    requiresExplicitInvocation: input?.requiresExplicitInvocation ?? true,
    defaultEntryIntent: "arisha_entry",
    supportsFollowupTurns: input?.supportsFollowupTurns ?? true,
    supportsSessionContinuation: input?.supportsSessionContinuation ?? true,
  };
}

export function getCanonicalAliceEntryPhrases(languageCode?: "ru" | "en" | "uz"): string[] {
  switch (languageCode) {
    case "ru":
      return RU_ENTRY_PHRASES;
    case "en":
      return EN_ENTRY_PHRASES;
    case "uz":
      return UZ_ENTRY_PHRASES;
    default:
      return RU_ENTRY_PHRASES; // Primary language for v1
  }
}

export function getDefaultAliceInvocationProfile(): AliceSkillInvocationProfile {
  return buildAliceInvocationProfile();
}
