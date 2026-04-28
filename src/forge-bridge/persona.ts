// ─────────────────────────────────────────────────────────────
// FORGE BRIDGE HARDENING v1.0 — Persona Resolver
// Implements One Persona / Multi-Language Presence constraint
// ─────────────────────────────────────────────────────────────

import type { ForgeBundlePersonaContext, PersonaMode } from "./types.js";
import { ForgeBundlePersonaInvalidError } from "./errors.js";

const VALID_PERSONA_MODES: Set<PersonaMode> = new Set([
  "arisha",
  "system",
  "operator",
  "neutral",
]);

const VALID_VOICE_SURFACES = new Set([
  "alice_bridge",
  "telegram_voice",
  "web_voice",
  "none",
]);

const VALID_TONE_CLASSES = new Set([
  "creator",
  "user",
  "neutral",
]);

export function resolvePersona(input: {
  personaMode?: PersonaMode;
  personaId?: "arisha";
  voiceSurface?: ForgeBundlePersonaContext["voiceSurface"];
  toneClass?: ForgeBundlePersonaContext["toneClass"];
}): ForgeBundlePersonaContext {
  const personaMode = input.personaMode ?? "neutral";

  if (!VALID_PERSONA_MODES.has(personaMode)) {
    throw new ForgeBundlePersonaInvalidError(
      `Invalid persona mode: ${personaMode}. Must be one of: ${Array.from(VALID_PERSONA_MODES).join(", ")}`
    );
  }

  // Validate voice surface if provided
  if (input.voiceSurface && !VALID_VOICE_SURFACES.has(input.voiceSurface)) {
    throw new ForgeBundlePersonaInvalidError(
      `Invalid voice surface: ${input.voiceSurface}. Must be one of: ${Array.from(VALID_VOICE_SURFACES).join(", ")}`
    );
  }

  // Validate tone class if provided
  if (input.toneClass && !VALID_TONE_CLASSES.has(input.toneClass)) {
    throw new ForgeBundlePersonaInvalidError(
      `Invalid tone class: ${input.toneClass}. Must be one of: ${Array.from(VALID_TONE_CLASSES).join(", ")}`
    );
  }

  // Auto-set personaId when mode is "arisha"
  const personaId = personaMode === "arisha" ? ("arisha" as const) : input.personaId;

  return {
    personaMode,
    personaId,
    voiceSurface: input.voiceSurface ?? "none",
    toneClass: input.toneClass ?? "neutral",
  };
}
