// ─────────────────────────────────────────────────────────────
// MULTILINGUAL LANGUAGE PACK CONTRACT v1.0 — Voice Pack
// ─────────────────────────────────────────────────────────────

import type { LanguageVoicePack } from "./types.js";
import { LanguagePackInvalidError } from "./errors.js";

const VALID_VOICE_SURFACES = new Set(["alice_bridge", "telegram_voice", "web_voice"] as const);

export function buildVoicePack(input: {
  textReady: boolean;
  voiceReady: boolean;
  preferredVoiceSurface?: LanguageVoicePack["preferredVoiceSurface"];
  fallbackToText: boolean;
  voiceNotes?: string[];
}): LanguageVoicePack {
  if (input.preferredVoiceSurface && !VALID_VOICE_SURFACES.has(input.preferredVoiceSurface)) {
    throw new LanguagePackInvalidError(
      `Invalid preferredVoiceSurface: ${input.preferredVoiceSurface}. Must be one of: ${Array.from(VALID_VOICE_SURFACES).join(", ")}`,
    );
  }

  return {
    textReady: input.textReady,
    voiceReady: input.voiceReady,
    preferredVoiceSurface: input.preferredVoiceSurface,
    fallbackToText: input.fallbackToText,
    voiceNotes: input.voiceNotes,
  };
}

export function validateVoicePack(voice: LanguageVoicePack): string[] {
  const errors: string[] = [];

  if (typeof voice.textReady !== "boolean") errors.push("textReady must be a boolean");
  if (typeof voice.voiceReady !== "boolean") errors.push("voiceReady must be a boolean");
  if (typeof voice.fallbackToText !== "boolean") errors.push("fallbackToText must be a boolean");
  if (voice.preferredVoiceSurface && !VALID_VOICE_SURFACES.has(voice.preferredVoiceSurface)) {
    errors.push(`Invalid preferredVoiceSurface: ${voice.preferredVoiceSurface}`);
  }

  return errors;
}
