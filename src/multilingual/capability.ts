// ─────────────────────────────────────────────────────────────
// MULTILINGUAL LANGUAGE PACK CONTRACT v1.0 — Capability Matrix
//
// language × surface × capability
// ─────────────────────────────────────────────────────────────

import type { LanguageCapabilityMatrix } from "./types.js";
import { LanguagePackInvalidError } from "./errors.js";

const VALID_CAPABILITY_LEVELS = new Set(["none", "text_ready", "full"] as const);

export function buildCapabilityMatrix(input: {
  web: LanguageCapabilityMatrix["web"];
  tgm: LanguageCapabilityMatrix["tgm"];
  telegram: LanguageCapabilityMatrix["telegram"];
  voice: LanguageCapabilityMatrix["voice"];
  operator: LanguageCapabilityMatrix["operator"];
  safeActions: boolean;
  protectedActions: boolean;
}): LanguageCapabilityMatrix {
  for (const [surface, level] of Object.entries({
    web: input.web,
    tgm: input.tgm,
    telegram: input.telegram,
    voice: input.voice,
    operator: input.operator,
  })) {
    if (!VALID_CAPABILITY_LEVELS.has(level as any)) {
      throw new LanguagePackInvalidError(
        `Invalid capability level for ${surface}: ${level}. Must be one of: ${Array.from(VALID_CAPABILITY_LEVELS).join(", ")}`,
      );
    }
  }

  return {
    web: input.web,
    tgm: input.tgm,
    telegram: input.telegram,
    voice: input.voice,
    operator: input.operator,
    safeActions: input.safeActions,
    protectedActions: input.protectedActions,
  };
}

export function getSurfaceCapability(
  matrix: LanguageCapabilityMatrix,
  surface: keyof Pick<LanguageCapabilityMatrix, "web" | "tgm" | "telegram" | "voice">,
): "none" | "text_ready" | "full" {
  return matrix[surface];
}

export function isSurfaceReady(
  matrix: LanguageCapabilityMatrix,
  surface: keyof Pick<LanguageCapabilityMatrix, "web" | "tgm" | "telegram" | "voice">,
): boolean {
  return matrix[surface] !== "none";
}

export function isSurfaceFull(
  matrix: LanguageCapabilityMatrix,
  surface: keyof Pick<LanguageCapabilityMatrix, "web" | "tgm" | "telegram" | "voice">,
): boolean {
  return matrix[surface] === "full";
}

export function canPerformSafeActions(matrix: LanguageCapabilityMatrix): boolean {
  return matrix.safeActions;
}

export function canPerformProtectedActions(matrix: LanguageCapabilityMatrix): boolean {
  return matrix.protectedActions;
}

export function validateCapabilityMatrix(matrix: LanguageCapabilityMatrix): string[] {
  const errors: string[] = [];

  for (const [surface, level] of Object.entries({
    web: matrix.web,
    tgm: matrix.tgm,
    telegram: matrix.telegram,
    voice: matrix.voice,
    operator: matrix.operator,
  })) {
    if (!VALID_CAPABILITY_LEVELS.has(level as any)) {
      errors.push(`Invalid capability level for ${surface}: ${level}`);
    }
  }

  return errors;
}
