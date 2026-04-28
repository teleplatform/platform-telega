// ─────────────────────────────────────────────────────────────
// ARISHA LANGUAGE UX FILES v1.0 — Persona Consistency Helpers
//
// One Persona / Different Language Expression / Same Character
// ─────────────────────────────────────────────────────────────

import type { ArishaLanguageUxFile, ArishaUxModePack } from "./types.js";

const VALID_PERSONA_ID = "arisha" as const;

export function assertPersonaConsistency(file: ArishaLanguageUxFile): boolean {
  return file.personaId === VALID_PERSONA_ID;
}

export function getModePack(
  file: ArishaLanguageUxFile,
  mode: "creator" | "user" | "neutral",
): ArishaUxModePack {
  return file.modeVariants[mode];
}

export function resolveModePack(
  file: ArishaLanguageUxFile,
  mode?: "creator" | "user" | "neutral",
): ArishaUxModePack {
  // If mode not specified or invalid, fall back to neutral
  if (!mode || !file.modeVariants[mode]) {
    return file.modeVariants.neutral;
  }
  return file.modeVariants[mode];
}

export function getModeDescription(mode: "creator" | "user" | "neutral"): string {
  switch (mode) {
    case "creator":
      return "AI partner — close, strong, professional, no hand-holding";
    case "user":
      return "Calm helper — simple, soft, clear, not overloaded";
    case "neutral":
      return "System-neutral — clean, short, honest, not dry";
    default:
      return "Unknown mode";
  }
}
