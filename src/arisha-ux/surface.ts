// ─────────────────────────────────────────────────────────────
// ARISHA LANGUAGE UX FILES v1.0 — Surface Behavior Helpers
// ─────────────────────────────────────────────────────────────

import type {
  ArishaLanguageUxFile,
  SurfaceResponseProfile,
} from "./types.js";

const SURFACE_KEYS: (keyof ArishaLanguageUxFile["surfaceBehavior"])[] = ["web", "tgm", "telegram", "voice"];

export function getSurfaceProfile(
  file: ArishaLanguageUxFile,
  surface: keyof ArishaLanguageUxFile["surfaceBehavior"],
): SurfaceResponseProfile {
  return file.surfaceBehavior[surface];
}

export function getPreferredLength(
  file: ArishaLanguageUxFile,
  surface: keyof ArishaLanguageUxFile["surfaceBehavior"],
): "short" | "medium" {
  return file.surfaceBehavior[surface]?.defaultLength ?? "short";
}

export function getMaxSentences(
  file: ArishaLanguageUxFile,
  surface: keyof ArishaLanguageUxFile["surfaceBehavior"],
): number {
  return file.surfaceBehavior[surface]?.maxSentences ?? 2;
}

export function prefersDirectness(
  file: ArishaLanguageUxFile,
  surface: keyof ArishaLanguageUxFile["surfaceBehavior"],
): boolean {
  return file.surfaceBehavior[surface]?.prefersDirectness ?? true;
}

export function prefersClarifyFirst(
  file: ArishaLanguageUxFile,
  surface: keyof ArishaLanguageUxFile["surfaceBehavior"],
): boolean {
  return file.surfaceBehavior[surface]?.prefersClarifyFirst ?? false;
}

export function isSurfaceVoice(surface: keyof ArishaLanguageUxFile["surfaceBehavior"]): boolean {
  return surface === "voice";
}

export function isSurfaceText(surface: keyof ArishaLanguageUxFile["surfaceBehavior"]): boolean {
  return !isSurfaceVoice(surface);
}
